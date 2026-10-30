import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { device } from '@/lib/device';
import { table, transaction } from '@/lib/db/client';
import { qk } from '@/lib/query-client';
import type { Subscription, SubscriptionInsert } from '@/types/db';
import { toISODate } from '@/features/dues/dates';
import { syncAllReminders } from '@/features/dues/notifications';

import { detectRecurring } from './logic';

const DAY_MS = 86_400_000;

function invalidate(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: qk.subscriptions });
  qc.invalidateQueries({ queryKey: qk.summary });
  // Dues reference subscriptions (cascade on delete, derived proposals).
  qc.invalidateQueries({ queryKey: qk.dues });
  // Pending subscription dues and the unused-subscriptions digest may have changed.
  syncAllReminders().catch((e) => console.warn('[reminders] sync failed', e));
}

export function useSubscriptions() {
  return useQuery({
    queryKey: qk.subscriptions,
    queryFn: () => table('subscriptions').list({ order: 'name' }),
  });
}

export function useSubscription(id: string | undefined) {
  return useQuery({
    queryKey: [...qk.subscriptions, 'one', id],
    enabled: !!id,
    queryFn: async () => {
      const row = await table('subscriptions').get(id!);
      if (!row) throw new Error('Subscription not found');
      return row;
    },
  });
}

/** Accounts for the "paying account" picker. Same key/shape as the accounts feature (all rows). */
export function useAccountOptions() {
  return useQuery({
    queryKey: qk.accounts,
    queryFn: () => table('accounts').list({ order: 'name' }),
  });
}

export function useCreateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (row: SubscriptionInsert) => table('subscriptions').insert(row),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Subscription> }) =>
      (await table('subscriptions').update(id, patch))[0],
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await table('subscriptions').remove(id);
    },
    onSuccess: () => invalidate(qc),
  });
}

/**
 * Reads Android usage stats for app-linked subscriptions and stores newer last_used_at values.
 * Returns { access: false } when usage access isn't granted (or native module missing).
 */
export function useRefreshUsage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (subs: Subscription[]) => {
      const linked = subs.filter((s) => s.android_package && s.status === 'active');
      if (!linked.length) return { access: true, updated: 0 };
      if (!(await device.hasUsageAccess())) return { access: false, updated: 0 };
      // Usage stats retention varies by device; 120 days covers the unused threshold comfortably.
      const usage = await device.getAppUsage(
        [...new Set(linked.map((s) => s.android_package!))],
        Date.now() - 120 * DAY_MS,
      );
      const lastByPkg = new Map(usage.filter((u) => u.lastTimeUsed > 0).map((u) => [u.packageName, u.lastTimeUsed]));
      let updated = 0;
      for (const s of linked) {
        const t = lastByPkg.get(s.android_package!);
        if (!t || (s.last_used_at && new Date(s.last_used_at).getTime() >= t)) continue;
        await table('subscriptions').update(s.id, { last_used_at: new Date(t).toISOString() });
        updated++;
      }
      return { access: true, updated };
    },
    onSuccess: (r) => {
      if (r.updated) invalidate(qc);
    },
  });
}

/** "Still using this?" answer: yes stamps usage, no cancels the subscription. */
export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stillUsing }: { id: string; stillUsing: boolean }) => {
      const now = new Date().toISOString();
      const patch: Partial<Subscription> = stillUsing
        ? { last_checked_in_at: now, last_used_at: now }
        : { last_checked_in_at: now, status: 'cancelled' };
      await transaction(async (t) => {
        await t('subscriptions').update(id, patch);
        // A cancelled subscription has no upcoming charges to remind about.
        if (!stillUsing) await t('dues').remove({ subscription_id: id, status: 'pending' });
      });
    },
    onSuccess: () => invalidate(qc),
  });
}

/** Recurring debit charges from the last 180 days that look like untracked subscriptions. */
export function useRecurringCandidates() {
  return useQuery({
    queryKey: [...qk.subscriptions, 'candidates'],
    queryFn: async () => {
      const since = toISODate(new Date(Date.now() - 180 * DAY_MS));
      const [txns, subs] = await Promise.all([
        table('transactions').list({
          where: { direction: 'debit', occurred_at: { gte: since }, merchant: { neq: null } },
          order: 'occurred_at',
          limit: 5000,
        }),
        table('subscriptions').list(),
      ]);
      return detectRecurring(txns, subs);
    },
  });
}

/** Transactions whose merchant matches the subscription's pattern (case-insensitive). */
export function useSubscriptionTransactions(pattern: string | null | undefined) {
  return useQuery({
    queryKey: qk.transactions({ merchantLike: pattern }),
    enabled: !!pattern,
    queryFn: () =>
      table('transactions').list({
        where: { merchant: { contains: pattern! } },
        order: 'occurred_at desc',
        limit: 24,
      }),
  });
}
