import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-client';
import { table } from '@/lib/db/client';
import type { Account, AccountInsert } from '@/types/db';

export const accountKindLabel: Record<Account['kind'], string> = {
  bank: 'Bank',
  credit_card: 'Credit card',
  debit_card: 'Debit card',
  cash: 'Cash',
  wallet: 'Wallet',
};

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.accounts });
    qc.invalidateQueries({ queryKey: qk.summary });
  };
}

export function useAccounts() {
  return useQuery({
    queryKey: qk.accounts,
    queryFn: () => table('accounts').list({ where: { archived: false }, order: 'created_at' }),
  });
}

export function useAccount(id: string | undefined) {
  return useQuery({
    queryKey: [...qk.accounts, id],
    enabled: !!id,
    queryFn: async () => {
      const row = await table('accounts').get(id!);
      if (!row) throw new Error('Account not found');
      return row;
    },
  });
}

export function useCreateAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (a: AccountInsert) => table('accounts').insert({ ...a, balance_updated_at: new Date().toISOString() }),
    onSuccess: invalidate,
  });
}

export function useUpdateAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Account> & { id: string }) =>
      (await table('accounts').update(id, patch))[0],
    onSuccess: invalidate,
  });
}

export function useArchiveAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => table('accounts').update(id, { archived: true }),
    onSuccess: invalidate,
  });
}
