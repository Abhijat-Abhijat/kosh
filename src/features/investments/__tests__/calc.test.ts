import type { Holding } from '@/types/db';
import {
  addMonths,
  compound,
  computedFields,
  daysBetween,
  fdMaturityValue,
  fdValueAsOf,
  holdingCost,
  holdingValue,
  isISODate,
  licTotalOutlay,
  maturityValue,
  monthsBetween,
  nextEvent,
  nextPremiumDate,
  portfolioSummary,
  premiumsPaid,
  rdInstalmentsPaid,
  rdMaturityValue,
  rdNextInstalment,
  rdTotalInstalments,
  rdValueAsOf,
  tenureProgress,
  todayISO,
  totalPremiums,
} from '../calc';

const base: Holding = {
  id: 'x',
  kind: 'other',
  name: 'h',
  institution: null,
  symbol: null,
  units: null,
  invested_amount: 0,
  current_price: null,
  current_value: null,
  price_updated_at: null,
  interest_rate: null,
  compounding: null,
  start_date: null,
  maturity_date: null,
  installment_amount: null,
  installment_day: null,
  premium_frequency: null,
  sum_assured: null,
  account_id: null,
  notes: null,
  closed: false,
  created_at: '2024-01-01T00:00:00Z',
};
const h = (p: Partial<Holding>): Holding => ({ ...base, ...p });

describe('date helpers', () => {
  it('validates ISO dates', () => {
    expect(isISODate('2024-02-29')).toBe(true);
    expect(isISODate('2023-02-29')).toBe(false);
    expect(isISODate('2024-2-1')).toBe(false);
    expect(isISODate('2024-13-01')).toBe(false);
  });

  it('counts days without timezone drift, across DST-like boundaries and leap years', () => {
    expect(daysBetween('2024-01-01', '2025-01-01')).toBe(366);
    expect(daysBetween('2025-01-01', '2026-01-01')).toBe(365);
    expect(daysBetween('2024-03-30', '2024-04-01')).toBe(2);
  });

  it('adds months with end-of-month clamping', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2023-01-31', 1)).toBe('2023-02-28');
    expect(addMonths('2024-11-15', 3)).toBe('2025-02-15');
    expect(addMonths('2024-01-05', 2, 31)).toBe('2024-03-31');
    expect(addMonths('2024-01-05', 1, 31)).toBe('2024-02-29');
  });

  it('counts whole months', () => {
    expect(monthsBetween('2024-01-15', '2024-02-14')).toBe(0);
    expect(monthsBetween('2024-01-15', '2024-02-15')).toBe(1);
    expect(monthsBetween('2024-01-31', '2024-02-29')).toBe(1);
    expect(monthsBetween('2024-01-01', '2029-01-01')).toBe(60);
  });

  it('formats today in local time', () => {
    expect(todayISO(new Date(2024, 0, 5, 23, 59))).toBe('2024-01-05');
    expect(todayISO(new Date(2024, 0, 5, 0, 1))).toBe('2024-01-05');
  });
});

describe('FD', () => {
  it('compounds quarterly by default', () => {
    // 1,00,000 @ 7% for one year, quarterly: 100000 * 1.0175^4
    expect(fdMaturityValue(100000, 7, '2025-01-01', '2026-01-01')).toBeCloseTo(107185.9, 1);
  });

  it('supports other compounding frequencies', () => {
    expect(compound(100000, 12, 1, 'monthly')).toBeCloseTo(112682.5, 1);
    expect(compound(100000, 8, 1, 'half_yearly')).toBeCloseTo(108160, 2);
    expect(compound(100000, 8, 2, 'yearly')).toBeCloseTo(116640, 2);
  });

  it('values to date and caps at maturity', () => {
    expect(fdValueAsOf(100000, 7, '2025-01-01', '2026-01-01', '2024-06-01')).toBe(100000);
    expect(fdValueAsOf(100000, 7, '2025-01-01', '2026-01-01', '2025-01-01')).toBe(100000);
    const mid = fdValueAsOf(100000, 7, '2025-01-01', '2026-01-01', '2025-07-02');
    expect(mid).toBeGreaterThan(103000);
    expect(mid).toBeLessThan(104000);
    expect(fdValueAsOf(100000, 7, '2025-01-01', '2026-01-01', '2027-06-01')).toBeCloseTo(107185.9, 1);
  });
});

describe('RD', () => {
  it('matches the bank closed-form formula', () => {
    const R = 5000;
    const r = 6.5;
    const months = 60;
    const i = r / 400;
    const n = months / 3;
    const closed = (R * (Math.pow(1 + i, n) - 1)) / (1 - Math.pow(1 + i, -1 / 3));
    expect(rdMaturityValue(R, r, months)).toBeCloseTo(closed, 6);
  });

  it('gives the familiar 1,000 x 12 @ 7.5% figure', () => {
    // Bank RD calculators show ~12,496
    expect(rdMaturityValue(1000, 7.5, 12)).toBeCloseTo(12495.69, 1);
  });

  it('counts instalments and finds the next one', () => {
    const s = '2025-01-10';
    const m = '2026-01-10';
    expect(rdTotalInstalments(s, m)).toBe(12);
    expect(rdInstalmentsPaid(s, m, '2025-01-09')).toBe(0);
    expect(rdInstalmentsPaid(s, m, '2025-01-10')).toBe(1);
    expect(rdInstalmentsPaid(s, m, '2025-03-10')).toBe(3);
    expect(rdInstalmentsPaid(s, m, '2030-01-01')).toBe(12);
    expect(rdNextInstalment(s, m, '2025-03-10')).toBe('2025-04-10');
    expect(rdNextInstalment(s, m, '2025-12-10')).toBeNull();
    // Custom instalment day
    expect(rdNextInstalment(s, m, '2025-01-10', 5)).toBe('2025-02-05');
    expect(rdNextInstalment(s, m, '2025-01-20', 31)).toBe('2025-02-28');
  });

  it('values to date and reaches maturity value at maturity', () => {
    const s = '2025-01-10';
    const m = '2026-01-10';
    expect(rdValueAsOf(1000, 7.5, s, m, '2025-01-01')).toBe(0);
    expect(rdValueAsOf(1000, 7.5, s, m, '2025-01-10')).toBe(1000);
    const three = rdValueAsOf(1000, 7.5, s, m, '2025-03-15');
    expect(three).toBeGreaterThan(3000);
    expect(three).toBeLessThan(3030);
    expect(rdValueAsOf(1000, 7.5, s, m, m)).toBeCloseTo(rdMaturityValue(1000, 7.5, 12), 6);
    expect(rdValueAsOf(1000, 7.5, s, m, '2028-01-01')).toBeCloseTo(rdMaturityValue(1000, 7.5, 12), 6);
  });
});

describe('LIC premiums', () => {
  const s = '2020-03-15';
  const m = '2040-03-15';

  it('counts premiums paid', () => {
    expect(premiumsPaid(s, 'yearly', '2020-03-14', m)).toBe(0);
    expect(premiumsPaid(s, 'yearly', '2020-03-15', m)).toBe(1);
    expect(premiumsPaid(s, 'yearly', '2025-03-14', m)).toBe(5);
    expect(premiumsPaid(s, 'yearly', '2025-03-15', m)).toBe(6);
    expect(premiumsPaid(s, 'quarterly', '2021-03-14', m)).toBe(4);
    expect(premiumsPaid(s, 'half_yearly', '2021-03-15', m)).toBe(3);
    expect(premiumsPaid(s, 'monthly', '2020-12-31', m)).toBe(10);
    expect(premiumsPaid(s, 'yearly', '2050-01-01', m)).toBe(20);
  });

  it('computes total outlay and next due date', () => {
    expect(totalPremiums(s, 'yearly', m)).toBe(20);
    expect(totalPremiums(s, 'quarterly', m)).toBe(80);
    expect(nextPremiumDate(s, 'yearly', '2025-06-01', m)).toBe('2026-03-15');
    expect(nextPremiumDate(s, 'half_yearly', '2025-06-01', m)).toBe('2025-09-15');
    expect(nextPremiumDate(s, 'yearly', '2039-04-01', m)).toBeNull();
  });

  it('values at premiums paid unless overridden', () => {
    const lic = h({ kind: 'lic', start_date: s, maturity_date: m, premium_frequency: 'yearly', installment_amount: 25000 });
    expect(holdingCost(lic, '2025-06-01')).toBe(150000);
    expect(holdingValue(lic, '2025-06-01')).toBe(150000);
    expect(holdingValue({ ...lic, current_value: 200000 }, '2025-06-01')).toBe(200000);
    expect(licTotalOutlay(lic)).toBe(500000);
  });
});

describe('market holdings', () => {
  it('values units x price with fallback', () => {
    const st = h({ kind: 'stock', units: 10, current_price: 2500, invested_amount: 20000 });
    expect(holdingValue(st, '2025-01-01')).toBe(25000);
    expect(holdingValue({ ...st, current_price: null }, '2025-01-01')).toBe(20000);
    expect(holdingValue({ ...st, current_price: null, current_value: 21000 }, '2025-01-01')).toBe(21000);
    const gold = h({ kind: 'gold', units: 2.5, current_price: 7000, invested_amount: 15000 });
    expect(holdingValue(gold, '2025-01-01')).toBe(17500);
  });

  it('PPF/other use current_value then invested', () => {
    expect(holdingValue(h({ kind: 'ppf', invested_amount: 50000 }), '2025-01-01')).toBe(50000);
    expect(holdingValue(h({ kind: 'ppf', invested_amount: 50000, current_value: 56000 }), '2025-01-01')).toBe(56000);
  });
});

describe('dispatch helpers', () => {
  const fd = h({
    kind: 'fd',
    invested_amount: 100000,
    interest_rate: 7,
    start_date: '2025-01-01',
    maturity_date: '2026-01-01',
  });

  it('fd value, maturity and progress', () => {
    expect(maturityValue(fd)).toBeCloseTo(107185.9, 1);
    expect(holdingValue(fd, '2026-01-01')).toBeCloseTo(107185.9, 1);
    expect(tenureProgress(fd, '2024-01-01')).toBe(0);
    expect(tenureProgress(fd, '2025-07-02')).toBeCloseTo(0.5, 2);
    expect(tenureProgress(fd, '2027-01-01')).toBe(1);
    expect(nextEvent(fd, '2025-06-01')).toEqual({ date: '2026-01-01', label: 'Matures' });
    expect(nextEvent(fd, '2026-02-01')).toBeNull();
  });

  it('rd next event is the instalment, cost grows with instalments', () => {
    const rd = h({
      kind: 'rd',
      installment_amount: 1000,
      interest_rate: 7.5,
      start_date: '2025-01-10',
      maturity_date: '2026-01-10',
    });
    expect(nextEvent(rd, '2025-03-11')).toEqual({ date: '2025-04-10', label: 'Instalment' });
    expect(holdingCost(rd, '2025-03-11')).toBe(3000);
    expect(maturityValue(rd)).toBeCloseTo(12495.69, 1);
  });

  it('computedFields stores value for fd/rd and premiums for lic', () => {
    const f = computedFields(fd, '2026-01-01');
    expect(f.invested_amount).toBe(100000);
    expect(f.current_value).toBeCloseTo(107185.9, 1);
    expect(computedFields(h({ kind: 'stock' }), '2026-01-01')).toEqual({});
  });
});

describe('portfolioSummary', () => {
  const asOf = '2025-06-01';
  const list = [
    h({ kind: 'fd', invested_amount: 100000, interest_rate: 7, start_date: '2025-01-01', maturity_date: '2025-08-01' }),
    h({ kind: 'fd', invested_amount: 50000, interest_rate: 7, start_date: '2025-01-01', maturity_date: '2027-01-01' }),
    h({ kind: 'stock', units: 10, current_price: 120, invested_amount: 1000 }),
    h({ kind: 'stock', units: 10, current_price: 80, invested_amount: 1000 }),
    h({ kind: 'gold', units: 1, current_price: 9000, invested_amount: 9000, closed: true }),
  ];
  const s = portfolioSummary(list, asOf);

  it('groups by kind in display order and skips closed', () => {
    expect(s.byKind.map((k) => k.kind)).toEqual(['fd', 'stock']);
    const stock = s.byKind[1];
    expect(stock.count).toBe(2);
    expect(stock.value).toBe(2000);
    expect(stock.cost).toBe(2000);
    expect(stock.gain).toBe(0);
  });

  it('totals and gains', () => {
    expect(s.totalCost).toBe(152000);
    expect(s.totalValue).toBeGreaterThan(152000);
    expect(s.gain).toBeCloseTo(s.totalValue - s.totalCost, 6);
    expect(s.gainPct).toBeCloseTo((s.gain / s.totalCost) * 100, 6);
    expect(s.byKind[0].next).toEqual({ date: '2025-08-01', label: 'Matures' });
  });

  it('lists maturities in the next 90 days', () => {
    expect(s.upcomingMaturities).toHaveLength(1);
    expect(s.upcomingMaturities[0].date).toBe('2025-08-01');
    expect(s.upcomingMaturities[0].value).toBeGreaterThan(100000);
  });

  it('handles empty input', () => {
    const e = portfolioSummary([], asOf);
    expect(e.totalValue).toBe(0);
    expect(e.gainPct).toBe(0);
    expect(e.byKind).toEqual([]);
  });
});
