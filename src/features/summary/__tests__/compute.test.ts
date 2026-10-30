import { computeSummary, monthlyAmount, type SummaryInput } from '../compute';

const now = new Date(2026, 9, 15, 12); // 15 Oct 2026, local time
const at = (m: number, d: number) => new Date(2026, m, d, 10).toISOString();

const input: SummaryInput = {
  accounts: [
    { id: 'a', name: 'HDFC', kind: 'bank', balance: 1000, balance_updated_at: '2026-10-10T00:00:00Z', archived: false },
    { id: 'b', name: 'Cash', kind: 'cash', balance: 200, balance_updated_at: '2026-10-12T00:00:00Z', archived: false },
    { id: 'c', name: 'Card', kind: 'credit_card', balance: 500, balance_updated_at: null, archived: false },
    { id: 'd', name: 'Old', kind: 'bank', balance: 9999, balance_updated_at: null, archived: true },
  ],
  categories: [
    { id: 'food', kind: 'expense' },
    { id: 'xfer', kind: 'transfer' },
  ],
  monthTxns: [
    { amount: 100, direction: 'debit', occurred_at: at(9, 1), category_id: 'food' },
    { amount: 50, direction: 'debit', occurred_at: at(9, 1), category_id: null },
    { amount: 300, direction: 'debit', occurred_at: at(9, 3), category_id: 'xfer' },
    { amount: 999, direction: 'credit', occurred_at: at(9, 3), category_id: null },
    { amount: 70, direction: 'debit', occurred_at: at(8, 30), category_id: null },
  ],
  holdings: [
    { invested_amount: 1000, current_value: 1200, closed: false },
    { invested_amount: 500, current_value: null, closed: false },
    { invested_amount: 800, current_value: 900, closed: true },
  ],
  dues: [
    { amount: 10, due_date: '2026-10-01', status: 'pending' }, // overdue
    { amount: 20, due_date: '2026-10-22', status: 'pending' }, // exactly 7 days out
    { amount: 40, due_date: '2026-10-23', status: 'pending' }, // too far
    { amount: 80, due_date: '2026-10-16', status: 'paid' },
  ],
  subscriptions: [
    { amount: 120, billing_cycle: 'yearly', status: 'active', last_used_at: null },
    { amount: 100, billing_cycle: 'monthly', status: 'active', last_used_at: '2026-10-10T00:00:00Z' },
    { amount: 300, billing_cycle: 'quarterly', status: 'active', last_used_at: '2026-08-01T00:00:00Z' },
    { amount: 999, billing_cycle: 'monthly', status: 'cancelled', last_used_at: null },
  ],
};

describe('computeSummary', () => {
  const s = computeSummary(input, now);

  it('sums liquid bank/cash balances, ignoring archived accounts and cards', () => {
    expect(s.liquid).toBe(1200);
    expect(s.perAccount.map((a) => a.id)).toEqual(['a', 'b']);
    expect(s.cardOutstanding).toBe(500);
    expect(s.lastBalanceUpdate).toBe('2026-10-12T00:00:00Z');
  });

  it('builds daily spend for this month excluding transfers and credits', () => {
    expect(s.dailySpend).toHaveLength(31);
    expect(s.dailySpend[0]).toBe(150);
    expect(s.dailySpend[2]).toBe(0);
    expect(s.monthSpent).toBe(150);
  });

  it('values open holdings at current value, falling back to cost', () => {
    expect(s.invested).toBe(1700);
    expect(s.investedCost).toBe(1500);
  });

  it('counts pending dues within 7 days, overdue included', () => {
    expect(s.dueSoon).toEqual({ count: 2, total: 30 });
  });

  it('flags active subs unused for 30 days with monthly-normalised waste', () => {
    expect(s.unusedSubs.count).toBe(2);
    expect(s.unusedSubs.monthlyWaste).toBeCloseTo(10 + 100);
  });
});

describe('monthlyAmount', () => {
  it('normalises billing cycles to a month', () => {
    expect(monthlyAmount(12, 'weekly')).toBeCloseTo(52);
    expect(monthlyAmount(30, 'quarterly')).toBe(10);
    expect(monthlyAmount(120, 'yearly')).toBe(10);
    expect(monthlyAmount(5, 'monthly')).toBe(5);
  });
});
