import { toISODate } from '@/lib/format';
import type { Account, BillingCycle, Category, Due, Holding, Subscription, Transaction } from '@/types/db';

const DAY = 86_400_000;
const LIQUID_KINDS = new Set(['bank', 'cash', 'wallet']);

export type SummaryInput = {
  accounts: Pick<Account, 'id' | 'name' | 'kind' | 'balance' | 'balance_updated_at' | 'archived'>[];
  /** Transactions from the start of the current month. */
  monthTxns: Pick<Transaction, 'amount' | 'direction' | 'occurred_at' | 'category_id'>[];
  categories: Pick<Category, 'id' | 'kind'>[];
  holdings: Pick<Holding, 'invested_amount' | 'current_value' | 'closed'>[];
  dues: Pick<Due, 'amount' | 'due_date' | 'status'>[];
  subscriptions: Pick<Subscription, 'amount' | 'billing_cycle' | 'status' | 'last_used_at'>[];
};

export function monthlyAmount(amount: number, cycle: BillingCycle) {
  switch (cycle) {
    case 'weekly':
      return (amount * 52) / 12;
    case 'quarterly':
      return amount / 3;
    case 'yearly':
      return amount / 12;
    default:
      return amount;
  }
}

export function computeSummary(input: SummaryInput, now = new Date()) {
  const accounts = input.accounts.filter((a) => !a.archived);
  const perAccount = accounts.filter((a) => LIQUID_KINDS.has(a.kind));
  const liquid = perAccount.reduce((s, a) => s + Number(a.balance), 0);
  const cardOutstanding = accounts
    .filter((a) => a.kind === 'credit_card')
    .reduce((s, a) => s + Number(a.balance), 0);
  const lastBalanceUpdate =
    accounts
      .map((a) => a.balance_updated_at)
      .filter((d): d is string => !!d)
      .sort()
      .at(-1) ?? null;

  // Spend: debits in the current local calendar month, excluding transfer categories.
  const transferIds = new Set(input.categories.filter((c) => c.kind === 'transfer').map((c) => c.id));
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailySpend: number[] = Array(daysInMonth).fill(0);
  for (const t of input.monthTxns) {
    if (t.direction !== 'debit' || (t.category_id && transferIds.has(t.category_id))) continue;
    const d = new Date(t.occurred_at);
    if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) continue;
    dailySpend[d.getDate() - 1] += Number(t.amount);
  }
  const monthSpent = dailySpend.reduce((s, v) => s + v, 0);

  const open = input.holdings.filter((h) => !h.closed);
  const invested = open.reduce((s, h) => s + Number(h.current_value ?? h.invested_amount), 0);
  const investedCost = open.reduce((s, h) => s + Number(h.invested_amount), 0);

  // Pending dues up to 7 days ahead, overdue included. YYYY-MM-DD compares as a string.
  const horizon = toISODate(new Date(now.getTime() + 7 * DAY));
  const soon = input.dues.filter((d) => d.status === 'pending' && d.due_date <= horizon);
  const dueSoon = { count: soon.length, total: soon.reduce((s, d) => s + Number(d.amount), 0) };

  const staleBefore = now.getTime() - 30 * DAY;
  const unused = input.subscriptions.filter(
    (s) => s.status === 'active' && (!s.last_used_at || new Date(s.last_used_at).getTime() < staleBefore),
  );
  const unusedSubs = {
    count: unused.length,
    monthlyWaste: unused.reduce((s, x) => s + monthlyAmount(Number(x.amount), x.billing_cycle), 0),
  };

  return {
    liquid,
    perAccount,
    cardOutstanding,
    lastBalanceUpdate,
    monthSpent,
    dailySpend,
    invested,
    investedCost,
    dueSoon,
    unusedSubs,
  };
}

export type HomeSummary = ReturnType<typeof computeSummary>;
