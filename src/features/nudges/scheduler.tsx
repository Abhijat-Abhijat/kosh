import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { ensureNotificationPermission } from '@/features/dues/notifications';
import { NUDGE_ID, nextNudgeAt, pickNudgeBody } from './logic';
import { useNudgeSettings } from './store';

const CHANNEL = 'nudges';
const supported = Platform.OS === 'android' || Platform.OS === 'ios';

/** Replaces the single pending check-in reminder; none when disabled or not permitted. */
export async function rescheduleNudge(enabled: boolean) {
  if (!supported) return;
  await Notifications.cancelScheduledNotificationAsync(NUDGE_ID).catch(() => undefined);
  if (!enabled || !(await ensureNotificationPermission(false))) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Check-in reminders',
      description: 'An occasional nudge to update Kosh',
      importance: AndroidImportance.DEFAULT,
    });
  }
  await Notifications.scheduleNotificationAsync({
    identifier: NUDGE_ID,
    content: { title: 'Kosh', body: pickNudgeBody(), data: { type: 'nudge' } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: nextNudgeAt(new Date()),
      channelId: CHANNEL,
    },
  });
}

/** Every open/foreground pushes the next check-in 2–5 days out. Renders nothing. */
export function NudgeScheduler() {
  const enabled = useNudgeSettings((s) => s.enabled);
  useEffect(() => {
    if (!supported) return;
    const run = () => rescheduleNudge(enabled).catch((e) => console.warn('[nudges] schedule failed', e));
    run();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    return () => sub.remove();
  }, [enabled]);
  return null;
}
