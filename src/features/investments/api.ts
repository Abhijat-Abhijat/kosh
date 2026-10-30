import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-client';
import { table } from '@/lib/db/client';
import type { HoldingInsert } from '@/types/db';
import { computedFields, todayISO, type CalcHolding } from './calc';

export function useHoldings() {
  return useQuery({
    queryKey: qk.holdings,
    queryFn: () => table('holdings').list({ order: 'created_at desc' }),
  });
}

/** Reads from the list cache so detail opens instantly. */
export function useHolding(id: string | undefined) {
  const q = useHoldings();
  return { ...q, data: q.data?.find((h) => h.id === id) };
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.holdings });
    qc.invalidateQueries({ queryKey: qk.summary });
  };
}

const NULLS: Omit<CalcHolding, 'kind' | 'invested_amount' | 'closed'> = {
  units: null,
  current_price: null,
  current_value: null,
  interest_rate: null,
  compounding: null,
  start_date: null,
  maturity_date: null,
  installment_amount: null,
  installment_day: null,
  premium_frequency: null,
};

/** Adds the cached current_value / invested_amount for fd, rd and lic. */
function withComputed<T extends HoldingInsert>(row: T): T {
  const h = { ...NULLS, invested_amount: 0, closed: false, ...row } as CalcHolding;
  return { ...row, ...computedFields(h, todayISO()) };
}

export function useCreateHolding() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (row: HoldingInsert) => table('holdings').insert(withComputed(row)),
    onSuccess: invalidate,
  });
}

export function useUpdateHolding() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...row }: HoldingInsert & { id: string }) =>
      (await table('holdings').update(id, withComputed(row)))[0],
    onSuccess: invalidate,
  });
}

export function useCloseHolding() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, closed = true }: { id: string; closed?: boolean }) => table('holdings').update(id, { closed }),
    onSuccess: invalidate,
  });
}

export function useDeleteHolding() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => table('holdings').remove(id),
    onSuccess: invalidate,
  });
}

