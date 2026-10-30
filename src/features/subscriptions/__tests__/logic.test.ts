import type { Subscription, Transaction } from '@/types/db';

import { findService, suggestServices } from '../known-services';
import {
  daysUnused,
  detectRecurring,
  isUnused,
  monthlyCost,
  needsCheckIn,
  nextChargeDate,
  normaliseMerchant,
  wastedSoFar,
} from '../logic';

const NOW = new Date(2026, 9, 30, 12, 0); // 30 Oct 2026, local noon

function sub(p: Partial<Subscription> = {}): Subscription {
  return {
    id: 's1',
    name: 'Netflix',
    amount: 649,
    billing_cycle: 'monthly',
    next_charge_date: '2026-11-05',
    account_id: null,
    android_package: 'com.netflix.mediaclient',
    merchant_pattern: 'netflix',
    status: 'active',
    last_used_at: null,
    last_checked_in_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...p,
  };
}

function txn(merchant: string, amount: number, date: string, p: Partial<Transaction> = {}) {
  return {
    merchant,
    amount,
    direction: 'debit' as const,
    occurred_at: `${date}T10:00:00`,
    subscription_id: null,
    ...p,
  };
}

describe('monthlyCost', () => {
  it('normalises each cycle to a month', () => {
    expect(monthlyCost(649, 'monthly')).toBe(649);
    expect(monthlyCost(1200, 'yearly')).toBe(100);
    expect(monthlyCost(300, 'quarterly')).toBe(100);
    expect(monthlyCost(120, 'weekly')).toBeCloseTo(520);
  });
});

describe('nextChargeDate', () => {
  it('keeps future dates', () => {
    expect(nextChargeDate('2026-11-05', 'monthly', NOW)).toBe('2026-11-05');
  });
  it('keeps today', () => {
    expect(nextChargeDate('2026-10-30', 'monthly', NOW)).toBe('2026-10-30');
  });
  it('rolls monthly forward past today, keeping the anchor day', () => {
    expect(nextChargeDate('2026-01-31', 'monthly', NOW)).toBe('2026-10-31');
    expect(nextChargeDate('2026-08-15', 'monthly', NOW)).toBe('2026-11-15');
  });
  it('rolls weekly, quarterly and yearly', () => {
    expect(nextChargeDate('2026-10-01', 'weekly', NOW)).toBe('2026-11-05');
    expect(nextChargeDate('2026-03-10', 'quarterly', NOW)).toBe('2026-12-10');
    expect(nextChargeDate('2024-02-29', 'yearly', NOW)).toBe('2027-02-28');
  });
});

describe('unused detection', () => {
  it('counts days since last use, falling back to created_at', () => {
    expect(daysUnused(sub({ last_used_at: '2026-09-26T12:00:00' }), NOW)).toBe(34);
    expect(daysUnused(sub({ created_at: '2026-10-20T12:00:00' }), NOW)).toBe(10);
  });
  it('flags active subs past the threshold only', () => {
    expect(isUnused(sub({ last_used_at: '2026-09-26T12:00:00' }), NOW)).toBe(true);
    expect(isUnused(sub({ last_used_at: '2026-10-25T12:00:00' }), NOW)).toBe(false);
    expect(isUnused(sub({ last_used_at: '2026-09-26T12:00:00', status: 'cancelled' }), NOW)).toBe(false);
    expect(isUnused(sub({ last_used_at: '2026-10-20T12:00:00' }), NOW, 7)).toBe(true);
  });
});

describe('wastedSoFar', () => {
  it('sums charges after the last use', () => {
    // Used 26 Sep; charges on the 5th: 5 Oct only (5 Nov is in the future).
    expect(wastedSoFar(sub({ last_used_at: '2026-09-26T12:00:00' }), NOW)).toBe(649);
    // Used 1 Sep: charges 5 Sep, 5 Oct.
    expect(wastedSoFar(sub({ last_used_at: '2026-09-01T12:00:00' }), NOW)).toBe(1298);
  });
  it('is zero when used after the last charge', () => {
    expect(wastedSoFar(sub({ last_used_at: '2026-10-28T12:00:00' }), NOW)).toBe(0);
  });
  it('handles an anchor that is already in the past', () => {
    expect(wastedSoFar(sub({ next_charge_date: '2026-06-05', last_used_at: '2026-09-01T12:00:00' }), NOW)).toBe(1298);
  });
  it('approximates by elapsed cycles without an anchor', () => {
    expect(wastedSoFar(sub({ next_charge_date: null, last_used_at: '2026-08-30T12:00:00' }), NOW)).toBe(1298);
  });
  it('is zero for inactive subs', () => {
    expect(wastedSoFar(sub({ status: 'paused', last_used_at: '2026-01-01T00:00:00Z' }), NOW)).toBe(0);
  });
});

describe('needsCheckIn', () => {
  const manual = { android_package: null, created_at: '2026-01-01T00:00:00Z' };
  it('asks for subs without an app after 21 days', () => {
    expect(needsCheckIn(sub({ ...manual, last_checked_in_at: '2026-10-01T00:00:00' }), NOW)).toBe(true);
    expect(needsCheckIn(sub({ ...manual, last_checked_in_at: '2026-10-20T00:00:00' }), NOW)).toBe(false);
  });
  it('treats a recent last_used_at as a check-in', () => {
    expect(needsCheckIn(sub({ ...manual, last_used_at: '2026-10-25T00:00:00' }), NOW)).toBe(false);
  });
  it('never asks for app-linked or inactive subs', () => {
    expect(needsCheckIn(sub({ created_at: '2026-01-01T00:00:00Z' }), NOW)).toBe(false);
    expect(needsCheckIn(sub({ ...manual, status: 'cancelled' }), NOW)).toBe(false);
  });
});

describe('normaliseMerchant', () => {
  it('strips digits, punctuation and boilerplate', () => {
    expect(normaliseMerchant('NETFLIX.COM*1234')).toBe('netflix');
    expect(normaliseMerchant('Spotify India Pvt Ltd')).toBe('spotify');
    expect(normaliseMerchant('UPI-TINDER 88')).toBe('tinder');
  });
});

describe('detectRecurring', () => {
  it('finds a monthly charge with amounts within 5%', () => {
    const out = detectRecurring([
      txn('NETFLIX.COM 111', 649, '2026-08-05'),
      txn('Netflix.com 222', 649, '2026-09-05'),
      txn('NETFLIX.COM 333', 660, '2026-10-05'),
    ]);
    expect(out).toEqual([
      { key: 'netflix', merchant: 'NETFLIX.COM 333', amount: 660, cycle: 'monthly', lastCharged: '2026-10-05', occurrences: 3 },
    ]);
  });

  it('needs two monthly occurrences but three weekly ones', () => {
    expect(detectRecurring([txn('Bumble', 499, '2026-09-10'), txn('Bumble', 499, '2026-10-10')])[0]?.cycle).toBe('monthly');
    expect(detectRecurring([txn('Gym', 200, '2026-10-01'), txn('Gym', 200, '2026-10-08')])).toEqual([]);
    expect(
      detectRecurring([txn('Gym', 200, '2026-10-01'), txn('Gym', 200, '2026-10-08'), txn('Gym', 200, '2026-10-15')])[0]?.cycle,
    ).toBe('weekly');
  });

  it('detects quarterly and tolerates one missed month', () => {
    expect(detectRecurring([txn('Swiggy One', 299, '2026-04-02'), txn('Swiggy One', 299, '2026-07-03')])[0]?.cycle).toBe(
      'quarterly',
    );
    expect(
      detectRecurring([txn('Hinge', 999, '2026-06-01'), txn('Hinge', 999, '2026-07-01'), txn('Hinge', 999, '2026-09-01')])[0]
        ?.cycle,
    ).toBe('monthly');
  });

  it('ignores irregular, credit, differently-priced and already-linked charges', () => {
    expect(detectRecurring([txn('Zomato', 300, '2026-10-01'), txn('Zomato', 450, '2026-10-12'), txn('Zomato', 280, '2026-10-20')])).toEqual([]);
    expect(detectRecurring([txn('Salary', 1000, '2026-09-01', { direction: 'credit' }), txn('Salary', 1000, '2026-10-01', { direction: 'credit' })])).toEqual([]);
    expect(detectRecurring([txn('Spotify', 119, '2026-09-01'), txn('Spotify', 179, '2026-10-01')])).toEqual([]);
    expect(
      detectRecurring([txn('Spotify', 119, '2026-09-01', { subscription_id: 'x' }), txn('Spotify', 119, '2026-10-01', { subscription_id: 'x' })]),
    ).toEqual([]);
  });

  it('excludes merchants matched by an existing merchant_pattern', () => {
    const t = [txn('NETFLIX.COM', 649, '2026-09-05'), txn('NETFLIX.COM', 649, '2026-10-05')];
    expect(detectRecurring(t, [{ name: 'Netflix', merchant_pattern: 'Netflix' }])).toEqual([]);
    expect(detectRecurring(t, [{ name: 'Other', merchant_pattern: 'spotify' }])).toHaveLength(1);
  });

  it('sorts by monthly cost, highest first', () => {
    const out = detectRecurring([
      txn('Spotify', 119, '2026-09-01'),
      txn('Spotify', 119, '2026-10-01'),
      txn('Netflix', 649, '2026-09-05'),
      txn('Netflix', 649, '2026-10-05'),
    ]);
    expect(out.map((c) => c.key)).toEqual(['netflix', 'spotify']);
  });
});

describe('known services', () => {
  it('suggests by name, prefix matches first', () => {
    expect(suggestServices('net')[0].androidPackage).toBe('com.netflix.mediaclient');
    expect(suggestServices('hotstar').map((s) => s.name)).toEqual(['JioHotstar', 'Disney+ Hotstar']);
    expect(suggestServices('')).toEqual([]);
  });
  it('finds a service by package or merchant text', () => {
    expect(findService('com.tinder')?.name).toBe('Tinder');
    expect(findService('SPOTIFY INDIA')?.name).toBe('Spotify');
  });
});
