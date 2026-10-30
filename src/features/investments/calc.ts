// Pure investment math. All dates are Postgres `date` strings ('YYYY-MM-DD') handled in UTC
// so the device timezone never shifts a day.
import type { Holding, HoldingKind, PayFrequency } from '@/types/db';

const DAY = 86_400_000;

const PERIODS_PER_YEAR: Record<PayFrequency, number> = {
  monthly: 12,
  quarterly: 4,
  half_yearly: 2,
  yearly: 1,
};
const MONTHS_PER_PERIOD: Record<PayFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
};

// ---------- date helpers ----------

export function isISODate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function ms(iso: string) {
  return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
}

function fromMs(t: number) {
  return new Date(t).toISOString().slice(0, 10);
}

/** Today in local time as YYYY-MM-DD. */
export function todayISO(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function daysBetween(from: string, to: string) {
  return Math.round((ms(to) - ms(from)) / DAY);
}

function addDays(iso: string, n: number) {
  return fromMs(ms(iso) + n * DAY);
}

/** Adds months, clamping the day to the target month's end (Jan 31 + 1m = Feb 28/29). */
export function addMonths(iso: string, n: number, day?: number) {
  const y = +iso.slice(0, 4);
  const m = +iso.slice(5, 7) - 1 + n;
  const want = day ?? +iso.slice(8, 10);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return fromMs(Date.UTC(y, m, Math.min(want, last)));
}

/** Whole months from `from` to `to` (a month counts once its day-of-month is reached). */
export function monthsBetween(from: string, to: string) {
  let m = (+to.slice(0, 4) - +from.slice(0, 4)) * 12 + (+to.slice(5, 7) - +from.slice(5, 7));
  if (addMonths(from, m) > to) m -= 1;
  return m;
}

const minDate = (a: string, b: string) => (a < b ? a : b);

// ---------- FD ----------

/** A = P(1 + r/n)^(n·t), t in years. */
export function compound(principal: number, ratePct: number, years: number, freq: PayFrequency = 'quarterly') {
  const n = PERIODS_PER_YEAR[freq];
  return principal * Math.pow(1 + ratePct / 100 / n, n * Math.max(0, years));
}

export function fdMaturityValue(
  principal: number,
  ratePct: number,
  start: string,
  maturity: string,
  freq: PayFrequency = 'quarterly',
) {
  return compound(principal, ratePct, daysBetween(start, maturity) / 365, freq);
}

/** Accrued value on `asOf`, capped at maturity. */
export function fdValueAsOf(
  principal: number,
  ratePct: number,
  start: string,
  maturity: string | null,
  asOf: string,
  freq: PayFrequency = 'quarterly',
) {
  if (asOf <= start) return principal;
  const end = maturity ? minDate(asOf, maturity) : asOf;
  return compound(principal, ratePct, daysBetween(start, end) / 365, freq);
}

// ---------- RD ----------

/** Date of instalment k (0-based). The first is the start date; later ones fall on `day` if given. */
function rdInstalmentDate(start: string, k: number, day?: number | null) {
  return k === 0 ? start : addMonths(start, k, day ?? undefined);
}

export function rdTotalInstalments(start: string, maturity: string) {
  return Math.max(0, monthsBetween(start, maturity));
}

/** Instalments due on or before `asOf`. */
export function rdInstalmentsPaid(start: string, maturity: string, asOf: string, day?: number | null) {
  const total = rdTotalInstalments(start, maturity);
  let k = 0;
  while (k < total && rdInstalmentDate(start, k, day) <= asOf) k++;
  return k;
}

/** Next instalment strictly after `asOf`, or null when all are paid. */
export function rdNextInstalment(start: string, maturity: string, asOf: string, day?: number | null) {
  const k = rdInstalmentsPaid(start, maturity, asOf, day);
  return k < rdTotalInstalments(start, maturity) ? rdInstalmentDate(start, k, day) : null;
}

/**
 * Indian-bank RD maturity: each monthly instalment compounds quarterly for the months it stays
 * deposited. Equals R·((1+i)^n − 1) / (1 − (1+i)^(−1/3)), i = r/400, n = months/3.
 */
export function rdMaturityValue(instalment: number, ratePct: number, months: number) {
  const i = ratePct / 400;
  let sum = 0;
  for (let k = 1; k <= months; k++) sum += instalment * Math.pow(1 + i, k / 3);
  return sum;
}

/** Value to date: instalments paid so far, each grown for the whole months it has been deposited. */
export function rdValueAsOf(
  instalment: number,
  ratePct: number,
  start: string,
  maturity: string,
  asOf: string,
  day?: number | null,
) {
  const total = rdTotalInstalments(start, maturity);
  const paid = rdInstalmentsPaid(start, maturity, asOf, day);
  const elapsed = Math.min(total, Math.max(0, monthsBetween(start, asOf)));
  const i = ratePct / 400;
  let sum = 0;
  for (let j = 0; j < paid; j++) sum += instalment * Math.pow(1 + i, Math.max(0, elapsed - j) / 3);
  return sum;
}

// ---------- LIC / periodic premiums ----------

function premiumDate(start: string, freq: PayFrequency, k: number) {
  return addMonths(start, k * MONTHS_PER_PERIOD[freq]);
}

/** Premiums due on or before `asOf` (and strictly before maturity). */
export function premiumsPaid(start: string, freq: PayFrequency, asOf: string, maturity?: string | null) {
  let k = 0;
  for (;;) {
    const d = premiumDate(start, freq, k);
    if (d > asOf || (maturity && d >= maturity)) return k;
    k++;
  }
}

export function totalPremiums(start: string, freq: PayFrequency, maturity: string) {
  return premiumsPaid(start, freq, maturity, maturity);
}

export function nextPremiumDate(start: string, freq: PayFrequency, asOf: string, maturity?: string | null) {
  const d = premiumDate(start, freq, premiumsPaid(start, freq, asOf, maturity));
  return maturity && d >= maturity ? null : d;
}

// ---------- per-holding dispatch ----------

export type CalcHolding = Pick<
  Holding,
  | 'kind'
  | 'units'
  | 'invested_amount'
  | 'current_price'
  | 'current_value'
  | 'interest_rate'
  | 'compounding'
  | 'start_date'
  | 'maturity_date'
  | 'installment_amount'
  | 'installment_day'
  | 'premium_frequency'
  | 'closed'
>;

export const MARKET_KINDS: HoldingKind[] = ['stock', 'mutual_fund', 'gold'];

/** Money put in so far. RD and LIC grow with each instalment/premium; others use invested_amount. */
export function holdingCost(h: CalcHolding, asOf: string) {
  const amt = h.installment_amount ?? 0;
  if (h.kind === 'rd' && h.start_date && h.maturity_date && amt) {
    return amt * rdInstalmentsPaid(h.start_date, h.maturity_date, asOf, h.installment_day);
  }
  if (h.kind === 'lic' && h.start_date && h.premium_frequency && amt) {
    return amt * premiumsPaid(h.start_date, h.premium_frequency, asOf, h.maturity_date);
  }
  return h.invested_amount ?? 0;
}

export function holdingValue(h: CalcHolding, asOf: string): number {
  const rate = h.interest_rate ?? 0;
  switch (h.kind) {
    case 'fd':
      if (h.start_date) {
        return fdValueAsOf(h.invested_amount, rate, h.start_date, h.maturity_date, asOf, h.compounding ?? 'quarterly');
      }
      break;
    case 'rd':
      if (h.start_date && h.maturity_date && h.installment_amount) {
        return rdValueAsOf(h.installment_amount, rate, h.start_date, h.maturity_date, asOf, h.installment_day);
      }
      break;
    case 'lic':
      // Premiums paid, unless a surrender/current value was entered manually.
      return h.current_value ?? holdingCost(h, asOf);
    case 'stock':
    case 'mutual_fund':
    case 'gold':
      if (h.units != null && h.current_price != null) return h.units * h.current_price;
      break;
  }
  return h.current_value ?? h.invested_amount ?? 0;
}

/** Value at maturity for FD/RD; total premium outlay for LIC; null otherwise. */
export function maturityValue(h: CalcHolding): number | null {
  if (!h.start_date || !h.maturity_date) return null;
  const rate = h.interest_rate ?? 0;
  if (h.kind === 'fd') {
    return fdMaturityValue(h.invested_amount, rate, h.start_date, h.maturity_date, h.compounding ?? 'quarterly');
  }
  if (h.kind === 'rd' && h.installment_amount) {
    return rdMaturityValue(h.installment_amount, rate, rdTotalInstalments(h.start_date, h.maturity_date));
  }
  return null;
}

/** Total premiums payable over the policy term. */
export function licTotalOutlay(h: CalcHolding): number | null {
  if (!h.start_date || !h.maturity_date || !h.premium_frequency || !h.installment_amount) return null;
  return h.installment_amount * totalPremiums(h.start_date, h.premium_frequency, h.maturity_date);
}

/** Fraction of tenure elapsed, 0..1, or null without dates. */
export function tenureProgress(h: Pick<CalcHolding, 'start_date' | 'maturity_date'>, asOf: string) {
  if (!h.start_date || !h.maturity_date) return null;
  const total = daysBetween(h.start_date, h.maturity_date);
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, daysBetween(h.start_date, asOf) / total));
}

export type NextEvent = { date: string; label: 'Matures' | 'Premium' | 'Instalment' };

/** The nearest upcoming date that matters for a holding. */
export function nextEvent(h: CalcHolding, asOf: string): NextEvent | null {
  const events: NextEvent[] = [];
  if (h.maturity_date && h.maturity_date >= asOf) events.push({ date: h.maturity_date, label: 'Matures' });
  if (h.kind === 'lic' && h.start_date && h.premium_frequency) {
    const d = nextPremiumDate(h.start_date, h.premium_frequency, asOf, h.maturity_date);
    if (d) events.push({ date: d, label: 'Premium' });
  }
  if (h.kind === 'rd' && h.start_date && h.maturity_date) {
    const d = rdNextInstalment(h.start_date, h.maturity_date, asOf, h.installment_day);
    if (d) events.push({ date: d, label: 'Instalment' });
  }
  events.sort((a, b) => (a.date < b.date ? -1 : 1));
  return events[0] ?? null;
}

export const gainPct = (gain: number, cost: number) => (cost > 0 ? (gain / cost) * 100 : 0);

// ---------- portfolio ----------

type KindSummary = {
  kind: HoldingKind;
  count: number;
  value: number;
  cost: number;
  gain: number;
  gainPct: number;
  next: NextEvent | null;
};

export type PortfolioSummary<T extends CalcHolding = CalcHolding> = {
  byKind: KindSummary[];
  totalValue: number;
  totalCost: number;
  gain: number;
  gainPct: number;
  /** Open holdings maturing within 90 days, soonest first. */
  upcomingMaturities: { holding: T; date: string; value: number }[];
};

const KIND_ORDER: HoldingKind[] = ['fd', 'rd', 'stock', 'mutual_fund', 'gold', 'lic', 'ppf', 'other'];

export function portfolioSummary<T extends CalcHolding>(holdings: T[], asOf: string = todayISO()): PortfolioSummary<T> {
  const map = new Map<HoldingKind, KindSummary>();
  const horizon = addDays(asOf, 90);
  const upcoming: PortfolioSummary<T>['upcomingMaturities'] = [];

  for (const h of holdings) {
    if (h.closed) continue;
    const value = holdingValue(h, asOf);
    const s = map.get(h.kind) ?? { kind: h.kind, count: 0, value: 0, cost: 0, gain: 0, gainPct: 0, next: null };
    s.count++;
    s.value += value;
    s.cost += holdingCost(h, asOf);
    const ev = nextEvent(h, asOf);
    if (ev && (!s.next || ev.date < s.next.date)) s.next = ev;
    map.set(h.kind, s);
    if (h.maturity_date && h.maturity_date >= asOf && h.maturity_date <= horizon) {
      upcoming.push({ holding: h, date: h.maturity_date, value: maturityValue(h) ?? value });
    }
  }

  const byKind = KIND_ORDER.flatMap((k) => {
    const s = map.get(k);
    if (!s) return [];
    s.gain = s.value - s.cost;
    s.gainPct = gainPct(s.gain, s.cost);
    return [s];
  });
  const totalValue = byKind.reduce((a, s) => a + s.value, 0);
  const totalCost = byKind.reduce((a, s) => a + s.cost, 0);
  upcoming.sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    byKind,
    totalValue,
    totalCost,
    gain: totalValue - totalCost,
    gainPct: gainPct(totalValue - totalCost, totalCost),
    upcomingMaturities: upcoming,
  };
}

/** Fields to persist so other screens can read coalesce(current_value, invested_amount). */
export function computedFields(h: CalcHolding, asOf: string): { invested_amount?: number; current_value?: number | null } {
  const round = (n: number) => Math.round(n * 100) / 100;
  if (h.kind === 'fd' || h.kind === 'rd') {
    return { invested_amount: round(holdingCost(h, asOf)), current_value: round(holdingValue(h, asOf)) };
  }
  if (h.kind === 'lic') return { invested_amount: round(holdingCost(h, asOf)) };
  return {};
}
