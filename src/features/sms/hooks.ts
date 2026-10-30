import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { device, deviceCapabilities } from '@/lib/device';
import { table } from '@/lib/db/client';
import type { Transaction } from '@/types/db';
import { getLastSyncMs, getLastSyncResult, syncSms } from './sync';

const smsKeys = {
  status: ['sms', 'status'] as const,
  /** Under the 'transactions' prefix so any transaction invalidation refreshes it. */
  unmatched: ['transactions', { source: 'sms', unmatched: true }] as const,
};

const AFFECTED = new Set(['transactions', 'accounts', 'summary', 'sms']);

function invalidateAfterSync(qc: QueryClient) {
  return qc.invalidateQueries({
    predicate: (q) => typeof q.queryKey[0] === 'string' && AFFECTED.has(q.queryKey[0]),
  });
}

/** Manual "Sync now". */
export function useSmsSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: syncSms,
    onSettled: () => invalidateAfterSync(qc),
  });
}

const AUTO_SYNC_INTERVAL_MS = 10 * 60 * 1000;
let lastAutoSync = 0;

/**
 * Syncs on mount and whenever the app returns to the foreground, at most once per
 * 10 minutes, and only if SMS permission was already granted. No-op without the native module.
 */
export function useAutoSmsSync() {
  const qc = useQueryClient();
  useEffect(() => {
    if (!deviceCapabilities.available) return;
    let cancelled = false;
    const run = async () => {
      if (Date.now() - lastAutoSync < AUTO_SYNC_INTERVAL_MS) return;
      try {
        if (!(await device.hasSmsPermission()) || cancelled) return;
        lastAutoSync = Date.now();
        const result = await syncSms();
        if (result.read > 0) await invalidateAfterSync(qc);
      } catch (e) {
        console.warn('[sms] auto sync failed', e);
      }
    };
    run();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [qc]);
}

export type SmsStatus = {
  available: boolean;
  smsPermission: boolean;
  usageAccess: boolean;
  lastSyncMs: number | null;
  lastResult: Awaited<ReturnType<typeof getLastSyncResult>>;
};

/** Permission state + last sync info. Refetches on foreground (e.g. back from Usage Access settings). */
export function useSmsStatus() {
  const query = useQuery({
    queryKey: smsKeys.status,
    queryFn: async (): Promise<SmsStatus> => {
      const [smsPermission, usageAccess, lastSyncMs, lastResult] = await Promise.all([
        device.hasSmsPermission(),
        device.hasUsageAccess(),
        getLastSyncMs(),
        getLastSyncResult(),
      ]);
      return { available: deviceCapabilities.available, smsPermission, usageAccess, lastSyncMs, lastResult };
    },
    staleTime: 0,
  });
  const { refetch } = query;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refetch();
    });
    return () => sub.remove();
  }, [refetch]);
  return query;
}

export function useRequestSmsPermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => device.requestSmsPermission(),
    onSettled: () => qc.invalidateQueries({ queryKey: smsKeys.status }),
  });
}

export type UnmatchedSmsTxn = Pick<Transaction, 'id' | 'amount' | 'direction' | 'occurred_at' | 'merchant' | 'raw_sms'>;

/** Latest SMS-sourced transactions that could not be tied to an account. */
export function useUnmatchedSmsTransactions(limit = 20) {
  return useQuery({
    queryKey: [...smsKeys.unmatched, limit],
    queryFn: (): Promise<UnmatchedSmsTxn[]> =>
      table('transactions').list({
        where: { source: 'sms', account_id: null },
        order: 'occurred_at desc',
        limit,
      }),
  });
}
