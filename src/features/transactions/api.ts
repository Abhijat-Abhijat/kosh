import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-client';
import { table, transaction } from '@/lib/db/client';
import type { TableFn } from '@/lib/db/repo';
import type { Transaction, TransactionInsert, TxnDirection } from '@/types/db';
import { balanceDelta } from './balance';

const PAGE = 50;

export type TxnFilter = {
  accountId?: string;
  categoryId?: string;
  from?: string;
  to?: string;
  search?: string;
};

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['transactions'] });
    qc.invalidateQueries({ queryKey: qk.accounts });
    qc.invalidateQueries({ queryKey: qk.summary });
  };
}

export function useTransactions(filter: TxnFilter = {}) {
  return useInfiniteQuery({
    queryKey: qk.transactions(filter),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const s = filter.search?.trim();
      return table('transactions').list({
        where: {
          account_id: filter.accountId,
          category_id: filter.categoryId,
          occurred_at: filter.from || filter.to ? { gte: filter.from, lte: filter.to } : undefined,
          $or: s ? [{ merchant: { contains: s } }, { note: { contains: s } }] : undefined,
        },
        order: 'occurred_at desc',
        limit: PAGE,
        offset: pageParam,
      });
    },
    getNextPageParam: (last, pages) => (last.length < PAGE ? undefined : pages.length * PAGE),
  });
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: ['transactions', 'one', id],
    enabled: !!id,
    queryFn: async () => {
      const row = await table('transactions').get(id!);
      if (!row) throw new Error('Transaction not found');
      return row;
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    staleTime: Infinity,
    queryFn: () => table('categories').list({ order: 'name' }),
  });
}

/** Applies a manual transaction's effect to its account. Runs inside the caller's transaction. */
async function adjustBalance(t: TableFn, accountId: string, direction: TxnDirection, amount: number) {
  const acc = await t('accounts').get(accountId);
  if (!acc) return;
  // Debit card spends come out of the linked bank account.
  const target =
    acc.kind === 'debit_card' ? (acc.linked_account_id ? await t('accounts').get(acc.linked_account_id) : null) : acc;
  if (!target) return;
  await t('accounts').update(target.id, {
    balance: Number(target.balance) + balanceDelta(target.kind, direction, amount),
    balance_updated_at: new Date().toISOString(),
  });
}

const flip = (d: TxnDirection): TxnDirection => (d === 'debit' ? 'credit' : 'debit');

export function useCreateTransaction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (txn: TransactionInsert) =>
      transaction(async (t) => {
        const row = await t('transactions').insert({ source: 'manual', ...txn });
        if (row.source === 'manual' && row.account_id) {
          await adjustBalance(t, row.account_id, row.direction, Number(row.amount));
        }
        return row;
      }),
    onSuccess: invalidate,
  });
}

/** Edits metadata only (category, merchant, note, account). Balances are not re-applied. */
export function useUpdateTransaction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: Pick<Transaction, 'id'> & Partial<Pick<Transaction, 'category_id' | 'merchant' | 'note' | 'account_id'>>) =>
      (await table('transactions').update(id, patch))[0],
    onSuccess: invalidate,
  });
}

/** Deletes; a manual transaction's balance effect is reversed. */
export function useDeleteTransaction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (txn: Pick<Transaction, 'id' | 'source' | 'account_id' | 'direction' | 'amount'>) =>
      transaction(async (t) => {
        await t('transactions').remove(txn.id);
        if (txn.source === 'manual' && txn.account_id) {
          await adjustBalance(t, txn.account_id, flip(txn.direction), Number(txn.amount));
        }
      }),
    onSuccess: invalidate,
  });
}
