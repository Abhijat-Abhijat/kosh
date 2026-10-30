import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-client';
import { table, transaction } from '@/lib/db/client';
import type { Due, DueInsert } from '@/types/db';

import { generateDerivedDues, rollForward, type DerivedDue } from './logic';
import { cancelDueReminders, syncAllReminders } from './notifications';

function afterChange(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: qk.dues });
  qc.invalidateQueries({ queryKey: qk.summary });
  syncAllReminders()
    .then(() => qc.invalidateQueries({ queryKey: qk.dues }))
    .catch((e) => console.warn('[reminders] sync failed', e));
}

export function useDues() {
  return useQuery({
    queryKey: qk.dues,
    queryFn: () => table('dues').list({ order: 'due_date' }),
  });
}

export function useDue(id: string | undefined) {
  return useQuery({
    queryKey: [...qk.dues, 'one', id],
    enabled: !!id,
    queryFn: async () => {
      const row = await table('dues').get(id!);
      if (!row) throw new Error('Due not found');
      return row;
    },
  });
}

export function useCreateDue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (row: DueInsert) => table('dues').insert(row),
    onSuccess: () => afterChange(qc),
  });
}

export function useUpdateDue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Due> }) =>
      (await table('dues').update(id, patch))[0],
    onSuccess: () => afterChange(qc),
  });
}

export function useDeleteDue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (due: Pick<Due, 'id' | 'notification_id'>) => {
      await cancelDueReminders(due.notification_id);
      await table('dues').remove(due.id);
    },
    onSuccess: () => afterChange(qc),
  });
}

/** Marks a due paid (or skipped) and, for recurring dues, inserts the next one. */
export function useMarkPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ due, status = 'paid' }: { due: Due; status?: 'paid' | 'skipped' }) => {
      await cancelDueReminders(due.notification_id);
      const next = rollForward(due);
      // One transaction: a paid due without its successor (or vice versa) never hits disk.
      await transaction(async (t) => {
        await t('dues').update(due.id, {
          status,
          paid_at: status === 'paid' ? new Date().toISOString() : null,
          notification_id: null,
        });
        if (next) await t('dues').insert(next);
      });
      return next;
    },
    onSuccess: () => afterChange(qc),
  });
}

/** Proposed dues from cards, LIC/RD holdings and subscriptions that aren't tracked yet. */
export function useDerivedDues() {
  return useQuery({
    queryKey: [...qk.dues, 'derived'],
    queryFn: async () => {
      const [accounts, holdings, subs, dues] = await Promise.all([
        table('accounts').list({ where: { kind: 'credit_card' } }),
        table('holdings').list({ where: { kind: { in: ['lic', 'rd'] }, closed: false } }),
        table('subscriptions').list({ where: { status: 'active' } }),
        table('dues').list(),
      ]);
      return generateDerivedDues(accounts, holdings, subs, dues);
    },
  });
}

/** Inserts the proposals the user accepted. */
export function useGenerateDerivedDues() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (accepted: DerivedDue[]) => {
      if (!accepted.length) return;
      const rows: DueInsert[] = accepted.map(({ key: _key, source: _source, ...row }) => row);
      await transaction((t) => t('dues').insertMany(rows));
    },
    onSuccess: () => afterChange(qc),
  });
}
