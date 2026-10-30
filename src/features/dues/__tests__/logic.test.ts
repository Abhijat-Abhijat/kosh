import type { Account, Due, Holding, Subscription } from '@/types/db';

import { dueWhen, generateDerivedDues, groupDues, nextRecurrenceDate, rollForward } from '../logic';

const NOW = new Date(2026, 9, 30, 12, 0); // Fri 30 Oct 2026

function due(p: Partial<Due> = {}): Due {
  return {
    id: 'd1',
    title: 'Rent',
    amount: 20000,
    due_date: '2026-11-01',
    kind: 'other',
    account_id: null,
    holding_id: null,
    subscription_id: null,
    status: 'pending',
    paid_at: null,
    recurrence: 'none',
    notification_id: 'n1',
    created_at: '2026-01-01T00:00:00Z',
    ...p,
  };
}

const card: Account = {
  id: 'a1',
  name: 'HDFC Regalia',
  kind: 'credit_card',
  institution: 'HDFC',
  last4: '1234',
  balance: 12500,
  credit_limit: 200000,
  linked_account_id: null,
  billing_day: 18,
  due_day: 7,
  sms_sender_hint: null,
  balance_updated_at: null,
  archived: false,
  created_at: '2026-01-01T00:00:00Z',
};

function holding(p: Partial<Holding>): Holding {
  return {
    id: 'h1',
    kind: 'lic',
    name: 'Jeevan Anand',
    institution: 'LIC',
    symbol: null,
    units: null,
    invested_amount: 0,
    current_price: null,
    current_value: null,
    price_updated_at: null,
    interest_rate: null,
    compounding: null,
    start_date: '2020-11-15',
    maturity_date: null,
    installment_amount: 5000,
    installment_day: null,
    premium_frequency: 'yearly',
    sum_assured: null,
    account_id: 'bank',
    notes: null,
    closed: false,
    created_at: '2020-01-01T00:00:00Z',
    ...p,
  };
}

const netflix: Subscription = {
  id: 's1',
  name: 'Netflix',
  amount: 649,
  billing_cycle: 'monthly',
  next_charge_date: '2026-08-05',
  account_id: 'a1',
  android_package: null,
  merchant_pattern: null,
  status: 'active',
  last_used_at: null,
  last_checked_in_at: null,
  created_at: '2026-01-01T00:00:00Z',
};

describe('rollForward', () => {
  it('returns null for one-off dues', () => {
    expect(rollForward(due())).toBeNull();
  });
  it('creates the next pending due by recurrence', () => {
    const next = rollForward(due({ recurrence: 'monthly', due_date: '2026-01-31', status: 'paid', holding_id: 'h' }));
    expect(next).toMatchObject({ due_date: '2026-02-28', status: 'pending', recurrence: 'monthly', holding_id: 'h' });
    expect(next).not.toHaveProperty('notification_id');
    expect(nextRecurrenceDate('2026-11-07', 'quarterly')).toBe('2027-02-07');
    expect(nextRecurrenceDate('2026-11-07', 'half_yearly')).toBe('2027-05-07');
    expect(nextRecurrenceDate('2026-11-07', 'yearly')).toBe('2027-11-07');
  });
});

describe('groupDues', () => {
  it('splits pending dues into overdue, this week and later, sorted', () => {
    const g = groupDues(
      [
        due({ id: 'late', due_date: '2026-11-20' }),
        due({ id: 'od', due_date: '2026-10-29' }),
        due({ id: 'today', due_date: '2026-10-30' }),
        due({ id: 'wk', due_date: '2026-11-05' }),
        due({ id: 'next', due_date: '2026-11-06' }),
        due({ id: 'paid', due_date: '2026-10-01', status: 'paid' }),
      ],
      NOW,
    );
    expect(g.overdue.map((d) => d.id)).toEqual(['od']);
    expect(g.thisWeek.map((d) => d.id)).toEqual(['today', 'wk']);
    expect(g.later.map((d) => d.id)).toEqual(['next', 'late']);
  });
});

describe('generateDerivedDues', () => {
  it('proposes a credit card bill for the next due day with the outstanding balance', () => {
    const out = generateDerivedDues([card], [], [], [], NOW);
    expect(out).toEqual([
      expect.objectContaining({
        title: 'HDFC Regalia bill',
        amount: 12500,
        due_date: '2026-11-07',
        kind: 'card_bill',
        account_id: 'a1',
        recurrence: 'monthly',
      }),
    ]);
  });

  it('skips cards with nothing outstanding, archived cards and non-cards', () => {
    expect(
      generateDerivedDues(
        [{ ...card, balance: 0 }, { ...card, id: 'a2', archived: true }, { ...card, id: 'a3', kind: 'bank' }],
        [],
        [],
        [],
        NOW,
      ),
    ).toEqual([]);
  });

  it('proposes LIC premiums and RD instalments from holdings', () => {
    const out = generateDerivedDues(
      [],
      [
        holding({}),
        holding({ id: 'h2', kind: 'rd', name: 'SBI RD', installment_amount: 2000, installment_day: 10, premium_frequency: null }),
        holding({ id: 'h3', closed: true }),
        holding({ id: 'h4', kind: 'fd' }),
      ],
      [],
      [],
      NOW,
    );
    expect(out.map((d) => [d.holding_id, d.kind, d.due_date, d.amount, d.recurrence])).toEqual([
      ['h2', 'installment', '2026-11-10', 2000, 'monthly'],
      ['h1', 'premium', '2026-11-15', 5000, 'yearly'],
    ]);
  });

  it('skips instalments past maturity or beyond the horizon', () => {
    expect(generateDerivedDues([], [holding({ maturity_date: '2026-11-01' })], [], [], NOW)).toEqual([]);
    expect(generateDerivedDues([], [holding({ start_date: '2020-03-15' })], [], [], NOW)).toEqual([]);
  });

  it('proposes the next subscription charge rolled forward past today', () => {
    const out = generateDerivedDues([], [], [netflix, { ...netflix, id: 's2', status: 'cancelled' }], [], NOW);
    expect(out).toEqual([
      expect.objectContaining({ subscription_id: 's1', due_date: '2026-11-05', kind: 'subscription', amount: 649 }),
    ]);
  });

  it('dedupes against existing dues by source and date, and pending dues per source', () => {
    const existing = [
      due({ account_id: 'a1', kind: 'card_bill', due_date: '2026-11-07', status: 'paid' }),
      due({ id: 'd2', subscription_id: 's1', due_date: '2026-12-05', status: 'pending' }),
    ];
    expect(generateDerivedDues([card], [], [netflix], existing, NOW)).toEqual([]);
  });
});

describe('dueWhen', () => {
  it('describes the distance to the due date', () => {
    expect(dueWhen('2026-10-30', NOW)).toBe('today');
    expect(dueWhen('2026-10-31', NOW)).toBe('tomorrow');
    expect(dueWhen('2026-11-04', NOW)).toBe('in 5 days');
    expect(dueWhen('2026-10-27', NOW)).toBe('3 days late');
  });
});
