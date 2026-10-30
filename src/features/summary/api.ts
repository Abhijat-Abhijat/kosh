import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-client';
import { table } from '@/lib/db/client';
import { computeSummary } from './compute';

async function fetchSummary() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const [accounts, monthTxns, categories, holdings, dues, subscriptions] = await Promise.all([
    table('accounts').list({ where: { archived: false }, order: 'created_at' }),
    table('transactions').list({ where: { direction: 'debit', occurred_at: { gte: monthStart } } }),
    table('categories').list(),
    table('holdings').list({ where: { closed: false } }),
    table('dues').list({ where: { status: 'pending' } }),
    table('subscriptions').list({ where: { status: 'active' } }),
  ]);
  return computeSummary(
    {
      accounts,
      monthTxns,
      categories,
      holdings,
      dues,
      subscriptions,
    },
    now,
  );
}

export function useHomeSummary() {
  return useQuery({ queryKey: qk.summary, queryFn: fetchSummary });
}
