import type { Account } from '@/types/db';
import type { ParsedSms } from './parser';

export type MatchableAccount = Pick<
  Account,
  'id' | 'kind' | 'last4' | 'sms_sender_hint' | 'linked_account_id' | 'balance_updated_at' | 'archived'
>;

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** "VM-HDFCBK-S" contains hint "HDFCBK". */
export function senderMatches(address: string, hint: string | null): boolean {
  if (!hint) return false;
  const h = norm(hint);
  return h.length > 0 && norm(address).includes(h);
}

const CARD_KINDS = new Set(['credit_card', 'debit_card']);

function preferByKind<T extends MatchableAccount>(list: T[], p: ParsedSms): T[] {
  const wantCard = p.kind === 'card';
  const narrowed = list.filter((a) => (wantCard ? CARD_KINDS.has(a.kind) : !CARD_KINDS.has(a.kind)));
  return narrowed.length ? narrowed : list;
}

/**
 * Picks the account an SMS belongs to. Digits win; the sender hint breaks ties or, when the
 * SMS has no digits, decides alone if it is unambiguous. Returns null rather than guess.
 */
export function matchAccount<T extends MatchableAccount>(
  accounts: T[],
  p: ParsedSms,
  address: string,
): T | null {
  const active = accounts.filter((a) => !a.archived);
  if (p.last4) {
    const digits = p.last4;
    let hits = active.filter((a) => a.last4 && a.last4.endsWith(digits));
    if (hits.length > 1) {
      const bySender = hits.filter((a) => senderMatches(address, a.sms_sender_hint));
      if (bySender.length) hits = bySender;
    }
    if (hits.length > 1) hits = preferByKind(hits, p);
    return hits[0] ?? null;
  }
  const bySender = preferByKind(
    active.filter((a) => senderMatches(address, a.sms_sender_hint)),
    p,
  );
  return bySender.length === 1 ? bySender[0] : null;
}

/** Account whose balance an SMS "Avl Bal" describes: the bank itself, or a debit card's bank. */
export function balanceTarget<T extends MatchableAccount>(account: T, all: T[]): T | null {
  if (account.kind === 'bank') return account;
  if (account.kind === 'debit_card' && account.linked_account_id) {
    const bank = all.find((a) => a.id === account.linked_account_id);
    return bank && bank.kind === 'bank' ? bank : null;
  }
  return null;
}
