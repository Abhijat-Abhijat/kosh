// Pure subscription logic: costs, charge dates, unused detection, recurring-charge detection.
import {
  DAY_MS,
  addDays,
  addMonths,
  daysBetween,
  parseISODate,
  startOfDay,
  toISODate,
} from '@/features/dues/dates';
import type { BillingCycle, Subscription, Transaction } from '@/types/db';

const UNUSED_THRESHOLD_DAYS = 30;
const CHECK_IN_EVERY_DAYS = 21;

export const CYCLE_LABEL: Record<BillingCycle, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export const CYCLE_SHORT: Record<BillingCycle, string> = {
  weekly: 'wk',
  monthly: 'mo',
  quarterly: 'qtr',
  yearly: 'yr',
};

/** Normalised to a per-month figure. */
export function monthlyCost(amount: number, cycle: BillingCycle) {
  switch (cycle) {
    case 'weekly':
      return (amount * 52) / 12;
    case 'monthly':
      return amount;
    case 'quarterly':
      return amount / 3;
    case 'yearly':
      return amount / 12;
  }
}

/** Shift a date by n billing cycles (n may be negative). Month-based cycles keep `anchorDay`. */
function addCycles(d: Date, cycle: BillingCycle, n: number, anchorDay = d.getDate()) {
  if (cycle === 'weekly') return addDays(d, 7 * n);
  const months = cycle === 'monthly' ? 1 : cycle === 'quarterly' ? 3 : 12;
  return addMonths(d, months * n, anchorDay);
}

/** Rolls `from` forward by whole cycles until it is today or later. Returns YYYY-MM-DD. */
export function nextChargeDate(from: string | Date, cycle: BillingCycle, now: Date = new Date()) {
  const anchor = typeof from === 'string' ? parseISODate(from) : startOfDay(from);
  const today = startOfDay(now);
  let d = anchor;
  for (let k = 1; d < today && k < 5000; k++) d = addCycles(anchor, cycle, k, anchor.getDate());
  return toISODate(d);
}

/** Last evidence the subscription was used (usage stats or check-in), else when it was added. */
function lastUse(sub: Pick<Subscription, 'last_used_at' | 'created_at'>) {
  return new Date(sub.last_used_at ?? sub.created_at);
}

export function daysUnused(sub: Pick<Subscription, 'last_used_at' | 'created_at'>, now: Date = new Date()) {
  return Math.max(0, Math.floor((now.getTime() - lastUse(sub).getTime()) / DAY_MS));
}

export function isUnused(sub: Subscription, now: Date = new Date(), thresholdDays = UNUSED_THRESHOLD_DAYS) {
  return sub.status === 'active' && daysUnused(sub, now) >= thresholdDays;
}

/** Money charged on billing dates after the last use, up to now. */
export function wastedSoFar(sub: Subscription, now: Date = new Date()) {
  if (sub.status !== 'active') return 0;
  const since = lastUse(sub);
  if (!sub.next_charge_date) {
    // No anchor: approximate by full cycles elapsed.
    const cycleDays = sub.billing_cycle === 'weekly' ? 7 : sub.billing_cycle === 'monthly' ? 30 : sub.billing_cycle === 'quarterly' ? 91 : 365;
    return Math.floor(daysUnused(sub, now) / cycleDays) * sub.amount;
  }
  const anchor = parseISODate(sub.next_charge_date);
  const day = anchor.getDate();
  // Step back to the first charge date strictly after the last use.
  let k = 0;
  while (addCycles(anchor, sub.billing_cycle, k, day) > since && k > -5000) k--;
  while (addCycles(anchor, sub.billing_cycle, k, day) <= since && k < 5000) k++;
  let count = 0;
  for (let d = addCycles(anchor, sub.billing_cycle, k, day); d <= now && count < 5000; ) {
    count++;
    k++;
    d = addCycles(anchor, sub.billing_cycle, k, day);
  }
  return count * sub.amount;
}

/** Subscriptions with no linked app need a manual "Still using this?" every few weeks. */
export function needsCheckIn(sub: Subscription, now: Date = new Date(), everyDays = CHECK_IN_EVERY_DAYS) {
  if (sub.status !== 'active' || sub.android_package) return false;
  const stamps = [sub.last_checked_in_at, sub.last_used_at, sub.created_at]
    .filter((s): s is string => !!s)
    .map((s) => new Date(s).getTime());
  const latest = Math.max(...stamps);
  return now.getTime() - latest >= everyDays * DAY_MS;
}

// ---------- recurring-charge detection ----------

export type RecurringCandidate = {
  key: string; // normalised merchant
  merchant: string; // display name (latest raw merchant)
  amount: number;
  cycle: BillingCycle;
  lastCharged: string; // YYYY-MM-DD
  occurrences: number;
};

const NOISE = new Set([
  'pvt', 'ltd', 'limited', 'private', 'india', 'in', 'inc', 'llc', 'com', 'www', 'co',
  'payment', 'payments', 'autopay', 'mandate', 'upi', 'pos', 'ecom', 'si', 'ach', 'nach',
]);

/** "NETFLIX.COM*1234 MUMBAI" -> "netflix mumbai"; strips digits, punctuation and boilerplate words. */
export function normaliseMerchant(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !NOISE.has(w))
    .join(' ')
    .trim();
}

const PERIODS: { cycle: BillingCycle; days: number; tol: number; minCount: number }[] = [
  { cycle: 'weekly', days: 7, tol: 1, minCount: 3 },
  { cycle: 'monthly', days: 30.4, tol: 4, minCount: 2 },
  { cycle: 'quarterly', days: 91, tol: 7, minCount: 2 },
  { cycle: 'yearly', days: 365, tol: 15, minCount: 2 },
];

function classify(intervals: number[], count: number): BillingCycle | null {
  if (intervals.length === 0) return null;
  for (const p of PERIODS) {
    if (count < p.minCount) continue;
    // Every gap must be ~1x or ~2x the period (a missed month is fine), at least one exactly ~1x.
    let single = false;
    const ok = intervals.every((iv) => {
      if (Math.abs(iv - p.days) <= p.tol) return (single = true);
      return Math.abs(iv - 2 * p.days) <= p.tol * 2;
    });
    if (ok && single) return p.cycle;
  }
  return null;
}

type Txn = Pick<Transaction, 'amount' | 'direction' | 'merchant' | 'occurred_at' | 'subscription_id'>;

/**
 * Finds likely subscriptions in debit transactions: same normalised merchant, amount within ±5%,
 * charged at a regular weekly/monthly/quarterly/yearly interval.
 */
export function detectRecurring(
  transactions: Txn[],
  subscriptions: Pick<Subscription, 'merchant_pattern' | 'name'>[] = [],
): RecurringCandidate[] {
  const patterns = subscriptions
    .map((s) => s.merchant_pattern?.trim().toLowerCase())
    .filter((p): p is string => !!p);
  const matched = (raw: string, key: string) =>
    patterns.some((p) => raw.toLowerCase().includes(p) || key.includes(normaliseMerchant(p) || p));

  const groups = new Map<string, Txn[]>();
  for (const t of transactions) {
    if (t.direction !== 'debit' || !t.merchant || t.subscription_id || t.amount <= 0) continue;
    const key = normaliseMerchant(t.merchant);
    if (!key || matched(t.merchant, key)) continue;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  const out: RecurringCandidate[] = [];
  for (const [key, txns] of groups) {
    txns.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    // Cluster by amount (±5% of the cluster's first amount).
    const clusters: Txn[][] = [];
    for (const t of txns) {
      const c = clusters.find((cl) => Math.abs(t.amount - cl[0].amount) <= cl[0].amount * 0.05);
      if (c) c.push(t);
      else clusters.push([t]);
    }
    let best: RecurringCandidate | null = null;
    for (const cl of clusters) {
      const days = cl.map((t) => startOfDay(new Date(t.occurred_at)));
      const intervals = days.slice(1).map((d, i) => daysBetween(days[i], d)).filter((iv) => iv > 0);
      const cycle = classify(intervals, cl.length);
      if (!cycle) continue;
      const last = cl[cl.length - 1];
      const cand: RecurringCandidate = {
        key,
        merchant: last.merchant!.trim(),
        amount: last.amount,
        cycle,
        lastCharged: toISODate(days[days.length - 1]),
        occurrences: cl.length,
      };
      if (!best || cand.lastCharged > best.lastCharged) best = cand;
    }
    if (best) out.push(best);
  }
  return out.sort((a, b) => monthlyCost(b.amount, b.cycle) - monthlyCost(a.amount, a.cycle));
}
