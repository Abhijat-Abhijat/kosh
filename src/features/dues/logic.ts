// Pure dues logic: recurrence roll-forward, grouping, and derived-due proposals.
import { nextChargeDate } from '@/features/subscriptions/logic';
import type { Account, Due, DueInsert, DueKind, Holding, Recurrence, Subscription } from '@/types/db';

import { addDays, addMonths, dateWithDay, nextDayOfMonth, parseISODate, startOfDay, toISODate } from './dates';

export const DUE_KIND_LABEL: Record<DueKind, string> = {
  card_bill: 'Card bill',
  premium: 'Premium',
  installment: 'Instalment',
  subscription: 'Subscription',
  loan: 'Loan EMI',
  other: 'Other',
};

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: 'Once',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  half_yearly: 'Half-yearly',
  yearly: 'Yearly',
};

const RECURRENCE_MONTHS: Record<Exclude<Recurrence, 'none'>, number> = {
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
};

/** Next date after `dateISO` for the recurrence, or null for one-off dues. */
export function nextRecurrenceDate(dateISO: string, recurrence: Recurrence) {
  if (recurrence === 'none') return null;
  return toISODate(addMonths(parseISODate(dateISO), RECURRENCE_MONTHS[recurrence]));
}

/** The follow-up due to insert when a recurring due is paid or skipped; null for one-offs. */
export function rollForward(due: Due): DueInsert | null {
  const next = nextRecurrenceDate(due.due_date, due.recurrence);
  if (!next) return null;
  return {
    title: due.title,
    amount: due.amount,
    due_date: next,
    kind: due.kind,
    account_id: due.account_id,
    holding_id: due.holding_id,
    subscription_id: due.subscription_id,
    recurrence: due.recurrence,
    status: 'pending',
  };
}

export type DueGroups<T extends Pick<Due, 'due_date' | 'status'>> = { overdue: T[]; thisWeek: T[]; later: T[] };

/** Pending dues split into overdue (before today), this week (next 7 days incl. today), later. */
export function groupDues<T extends Pick<Due, 'due_date' | 'status'>>(dues: T[], now: Date = new Date()): DueGroups<T> {
  const today = toISODate(startOfDay(now));
  const weekEnd = toISODate(addDays(startOfDay(now), 6));
  const out: DueGroups<T> = { overdue: [], thisWeek: [], later: [] };
  const sorted = dues.filter((d) => d.status === 'pending').sort((a, b) => a.due_date.localeCompare(b.due_date));
  for (const d of sorted) {
    if (d.due_date < today) out.overdue.push(d);
    else if (d.due_date <= weekEnd) out.thisWeek.push(d);
    else out.later.push(d);
  }
  return out;
}

/** Proposed due with a stable key for the accept UI. */
export type DerivedDue = DueInsert & { key: string; source: 'account' | 'holding' | 'subscription' };

function sourceKey(d: Pick<Due, 'account_id' | 'holding_id' | 'subscription_id' | 'kind'>) {
  if (d.holding_id) return `h:${d.holding_id}`;
  if (d.subscription_id) return `s:${d.subscription_id}`;
  if (d.account_id && d.kind === 'card_bill') return `a:${d.account_id}`;
  return null;
}

/** Next instalment date of a holding on/after today, or null if it can't be determined. */
function holdingNextDate(h: Holding, freq: Exclude<Recurrence, 'none'>, now: Date) {
  const today = startOfDay(now);
  const start = h.start_date ? parseISODate(h.start_date) : null;
  const day = h.installment_day ?? start?.getDate();
  if (!day) return null;
  if (freq === 'monthly') return nextDayOfMonth(day, today);
  if (!start) return null;
  const step = RECURRENCE_MONTHS[freq];
  let d = dateWithDay(start.getFullYear(), start.getMonth(), day);
  for (let k = 1; d < today && k < 2000; k++) d = dateWithDay(start.getFullYear(), start.getMonth() + step * k, day);
  return d;
}

/**
 * Proposes pending dues the user hasn't created yet: credit card bills, LIC premiums, RD
 * instalments and subscription charges falling within `horizonDays`. Deduped against existing
 * dues by (source id, due_date), and skipped when the source already has a pending due.
 */
export function generateDerivedDues(
  accounts: Account[],
  holdings: Holding[],
  subscriptions: Subscription[],
  existingDues: Due[],
  now: Date = new Date(),
  horizonDays = 45,
): DerivedDue[] {
  const horizon = toISODate(addDays(startOfDay(now), horizonDays));
  const taken = new Set<string>();
  const pendingSources = new Set<string>();
  for (const d of existingDues) {
    const k = sourceKey(d);
    if (!k) continue;
    taken.add(`${k}|${d.due_date}`);
    if (d.status === 'pending') pendingSources.add(k);
  }

  const out: DerivedDue[] = [];
  const push = (src: string, source: DerivedDue['source'], due: DueInsert) => {
    if (due.due_date > horizon || pendingSources.has(src) || taken.has(`${src}|${due.due_date}`)) return;
    taken.add(`${src}|${due.due_date}`);
    out.push({ ...due, key: `${src}|${due.due_date}`, source });
  };

  for (const a of accounts) {
    if (a.kind !== 'credit_card' || a.archived || !a.due_day) continue;
    const outstanding = Math.abs(a.balance);
    if (outstanding <= 0) continue;
    push(`a:${a.id}`, 'account', {
      title: `${a.name} bill`,
      amount: outstanding,
      due_date: toISODate(nextDayOfMonth(a.due_day, now)),
      kind: 'card_bill',
      account_id: a.id,
      recurrence: 'monthly',
    });
  }

  for (const h of holdings) {
    if (h.closed || (h.kind !== 'lic' && h.kind !== 'rd') || !h.installment_amount) continue;
    const freq: Exclude<Recurrence, 'none'> = h.kind === 'rd' ? h.premium_frequency ?? 'monthly' : h.premium_frequency ?? 'yearly';
    const date = holdingNextDate(h, freq, now);
    if (!date) continue;
    const iso = toISODate(date);
    if (h.maturity_date && iso > h.maturity_date) continue;
    push(`h:${h.id}`, 'holding', {
      title: h.kind === 'lic' ? `${h.name} premium` : `${h.name} instalment`,
      amount: h.installment_amount,
      due_date: iso,
      kind: h.kind === 'lic' ? 'premium' : 'installment',
      account_id: h.account_id,
      holding_id: h.id,
      recurrence: freq,
    });
  }

  for (const s of subscriptions) {
    if (s.status !== 'active' || !s.next_charge_date) continue;
    push(`s:${s.id}`, 'subscription', {
      title: s.name,
      amount: s.amount,
      due_date: nextChargeDate(s.next_charge_date, s.billing_cycle, now),
      kind: 'subscription',
      account_id: s.account_id,
      subscription_id: s.id,
      recurrence: s.billing_cycle === 'weekly' ? 'none' : s.billing_cycle,
    });
  }

  return out.sort((a, b) => a.due_date.localeCompare(b.due_date));
}

/** "today", "tomorrow", "in 5 days", "3 days late". */
export function dueWhen(dateISO: string, now: Date = new Date()) {
  const n = Math.round((parseISODate(dateISO).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return '1 day late';
  return n > 0 ? `in ${n} days` : `${-n} days late`;
}
