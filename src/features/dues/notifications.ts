// Local reminders for pending dues + a weekly digest of unused subscriptions.
// Written against expo-notifications 58.x (SDK 58): shouldShowBanner/shouldShowList handler,
// typed SchedulableTriggerInputTypes triggers, Android channel passed per trigger.
import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router, type Href } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';

import { formatMoney } from '@/lib/format';
import { qk } from '@/lib/query-client';
import { table } from '@/lib/db/client';
import type { Due, Subscription } from '@/types/db';
import { isUnused, monthlyCost, wastedSoFar } from '@/features/subscriptions/logic';

import { addDays, parseISODate } from './dates';

const DUES_CHANNEL = 'dues';
const DUE_PREFIX = 'due-';
const DIGEST_ID = 'digest-weekly';
const REMIND_HOUR = 9;
const SYNC_EVERY_MS = 6 * 60 * 60 * 1000;
const LAST_SYNC_KEY = 'kosh_reminders_last_sync';

const supported = Platform.OS === 'android' || Platform.OS === 'ios';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(DUES_CHANNEL, {
    name: 'Payment reminders',
    description: 'Upcoming and overdue payments, unused subscriptions',
    importance: AndroidImportance.HIGH,
    lightColor: '#e0714c',
  });
}

/** Creates the channel (required before the Android 13 prompt appears) and asks once if allowed. */
export async function ensureNotificationPermission(ask = true) {
  if (!supported) return false;
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!ask || !current.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

type Planned = { identifier: string; date: Date; title: string; body: string; sig: string };

/** 9:00 local, 2 days before and on the due date; past times dropped. */
function plannedReminders(due: Pick<Due, 'id' | 'title' | 'amount' | 'due_date'>, now = new Date()): Planned[] {
  const day = parseISODate(due.due_date);
  const at9 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), REMIND_HOUR, 0, 0);
  const sig = `${due.due_date}|${due.amount}|${due.title}`;
  const money = formatMoney(due.amount);
  return [
    {
      identifier: `${DUE_PREFIX}${due.id}-pre`,
      date: at9(addDays(day, -2)),
      title: `${due.title} due in 2 days`,
      body: `${money} due on ${day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}. Tap to review.`,
      sig,
    },
    {
      identifier: `${DUE_PREFIX}${due.id}-day`,
      date: at9(day),
      title: `${due.title} is due today`,
      body: `${money} is due today. Pay it, then mark it paid in Kosh.`,
      sig,
    },
  ].filter((p) => p.date.getTime() > now.getTime());
}

async function schedule(p: Planned, data: Record<string, unknown>) {
  return Notifications.scheduleNotificationAsync({
    identifier: p.identifier,
    content: { title: p.title, body: p.body, data: { ...data, sig: p.sig }, color: '#e0714c' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.date, channelId: DUES_CHANNEL },
  });
}

/** Cancels reminders listed in a dues.notification_id value (comma-separated). */
export async function cancelDueReminders(notificationId: string | null | undefined) {
  if (!supported || !notificationId) return;
  await Promise.all(
    notificationId
      .split(',')
      .filter(Boolean)
      .map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)),
  );
}

/** Schedules (replacing) one due's reminders; returns the comma-separated ids to store. */
async function syncDigest(subs: Subscription[], now: Date) {
  const unused = subs.filter((s) => isUnused(s, now));
  await Notifications.cancelScheduledNotificationAsync(DIGEST_ID).catch(() => undefined);
  if (!unused.length) return;
  const perMonth = unused.reduce((t, s) => t + monthlyCost(s.amount, s.billing_cycle), 0);
  const wasted = unused.reduce((t, s) => t + wastedSoFar(s, now), 0);
  const names = unused.slice(0, 3).map((s) => s.name).join(', ') + (unused.length > 3 ? ` +${unused.length - 3}` : '');
  await Notifications.scheduleNotificationAsync({
    identifier: DIGEST_ID,
    content: {
      title: `${formatMoney(perMonth)}/mo on apps you don't open`,
      body: `${names} unused for 30+ days. ${formatMoney(wasted)} wasted so far. Cancel or check in.`,
      data: { type: 'digest' },
      color: '#e0714c',
    },
    // Expo weekdays: 1 = Sunday.
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1,
      hour: 10,
      minute: 0,
      channelId: DUES_CHANNEL,
    },
  });
}

let syncing: Promise<void> | null = null;

/**
 * Reconciles scheduled notifications with pending dues: cancels stale ones, schedules missing
 * or changed ones, writes ids back to dues.notification_id, and refreshes the weekly digest.
 */
export function syncAllReminders(): Promise<void> {
  if (!supported) return Promise.resolve();
  syncing ??= runSync().finally(() => {
    syncing = null;
  });
  return syncing;
}

async function runSync() {
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  await ensureChannel();
  const now = new Date();

  const [dues, subs, scheduled] = await Promise.all([
    table('dues').list({ where: { status: 'pending' } }),
    table('subscriptions').list({ where: { status: 'active' } }),
    Notifications.getAllScheduledNotificationsAsync(),
  ]);

  const existing = new Map(scheduled.map((r) => [r.identifier, r]));
  const wanted = new Set<string>();

  for (const due of dues) {
    const plans = plannedReminders(due, now);
    const ids: string[] = [];
    for (const p of plans) {
      wanted.add(p.identifier);
      const cur = existing.get(p.identifier);
      if (!cur || cur.content.data?.sig !== p.sig) {
        if (cur) await Notifications.cancelScheduledNotificationAsync(p.identifier);
        await schedule(p, { type: 'due', dueId: due.id });
      }
      ids.push(p.identifier);
    }
    const stored = ids.length ? ids.join(',') : null;
    if (stored !== due.notification_id) {
      await table('dues').update(due.id, { notification_id: stored });
    }
  }

  // Anything due-prefixed that no pending due wants (paid, skipped, deleted, moved) goes.
  for (const r of scheduled) {
    if (r.identifier.startsWith(DUE_PREFIX) && !wanted.has(r.identifier)) {
      await Notifications.cancelScheduledNotificationAsync(r.identifier);
    }
  }

  await syncDigest(subs, now);
  await SecureStore.setItemAsync(LAST_SYNC_KEY, String(Date.now())).catch(() => undefined);
}

async function syncIfStale() {
  const last = Number((await SecureStore.getItemAsync(LAST_SYNC_KEY).catch(() => null)) ?? 0);
  if (Date.now() - last < SYNC_EVERY_MS) return;
  await syncAllReminders();
}

/** Syncs reminders on mount and whenever the app returns to the foreground, at most every 6 hours. */
function useReminderSync() {
  const qc = useQueryClient();
  useEffect(() => {
    if (!supported) return;
    const run = () =>
      syncIfStale()
        .then(() => qc.invalidateQueries({ queryKey: qk.dues }))
        .catch((e) => console.warn('[reminders] sync failed', e));
    ensureNotificationPermission(true)
      .then(run)
      .catch(() => undefined);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    return () => sub.remove();
  }, [qc]);
}

/** Opens the relevant screen when a reminder is tapped. */
function useNotificationTaps() {
  useEffect(() => {
    if (!supported) return;
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      const data = res.notification.request.content.data as { type?: string; dueId?: string } | undefined;
      if (data?.type === 'due' && data.dueId) router.push(`/dues/${data.dueId}` as Href);
      else if (data?.type === 'digest') router.push('/subscriptions' as Href);
    });
    return () => sub.remove();
  }, []);
}

/** Mount once inside QueryClientProvider, Renders nothing. */
export function ReminderBootstrap() {
  useReminderSync();
  useNotificationTaps();
  return null;
}

/** Whether reminders can be shown; null while unknown or unsupported. Re-checks on foreground. */
export function useNotificationsEnabled() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    if (!supported) return;
    const check = () =>
      Notifications.getPermissionsAsync()
        .then((p) => setEnabled(p.granted))
        .catch(() => setEnabled(null));
    check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, []);
  const enable = async () => {
    const ok = await ensureNotificationPermission(true);
    setEnabled(ok);
    if (ok) await syncAllReminders();
    else Linking.openSettings();
  };
  return { enabled, enable };
}
