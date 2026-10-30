import { smsHash } from '../hash';
import { balanceTarget, matchAccount, senderMatches, type MatchableAccount } from '../match';
import type { ParsedSms } from '../parser';

const acct = (o: Partial<MatchableAccount> & { id: string }): MatchableAccount => ({
  kind: 'bank',
  last4: null,
  sms_sender_hint: null,
  linked_account_id: null,
  balance_updated_at: null,
  archived: false,
  ...o,
});

const p = (o: Partial<ParsedSms> = {}): ParsedSms => ({ amount: 100, direction: 'debit', occurredAt: 0, kind: 'bank', ...o });

const hdfcBank = acct({ id: 'hdfc', last4: '4821', sms_sender_hint: 'HDFCBK' });
const hdfcCard = acct({ id: 'hdfc-cc', kind: 'credit_card', last4: '1234', sms_sender_hint: 'HDFCBK' });
const sbi = acct({ id: 'sbi', last4: '3344', sms_sender_hint: 'SBIINB' });
const debit = acct({ id: 'hdfc-dc', kind: 'debit_card', last4: '9087', linked_account_id: 'hdfc' });
const all = [hdfcBank, hdfcCard, sbi, debit];

describe('matchAccount', () => {
  it('matches by last4', () => {
    expect(matchAccount(all, p({ last4: '3344' }), 'AD-SBIINB')?.id).toBe('sbi');
  });

  it('matches 3-digit masks by suffix', () => {
    expect(matchAccount(all, p({ last4: '821' }), 'VM-ICICIB')?.id).toBe('hdfc');
  });

  it('returns null when digits match nothing, even if the sender matches', () => {
    expect(matchAccount(all, p({ last4: '0000' }), 'VM-HDFCBK')).toBeNull();
  });

  it('breaks digit ties with the sender hint', () => {
    const dup = acct({ id: 'kotak', last4: '4821', sms_sender_hint: 'KOTAKB' });
    expect(matchAccount([hdfcBank, dup], p({ last4: '4821' }), 'JD-KOTAKB-S')?.id).toBe('kotak');
  });

  it('falls back to a unique sender hint when the SMS has no digits', () => {
    expect(matchAccount(all, p(), 'AD-SBIINB')?.id).toBe('sbi');
    expect(matchAccount(all, p({ kind: 'card' }), 'VM-HDFCBK')?.id).toBe('hdfc-cc');
    expect(matchAccount(all, p(), 'VM-HDFCBK')?.id).toBe('hdfc');
  });

  it('ignores archived accounts', () => {
    expect(matchAccount([{ ...sbi, archived: true }], p({ last4: '3344' }), 'AD-SBIINB')).toBeNull();
  });

  it('senderMatches ignores case and punctuation', () => {
    expect(senderMatches('vm-hdfcbk-s', 'HDFCBK')).toBe(true);
    expect(senderMatches('VM-HDFCBK', null)).toBe(false);
    expect(senderMatches('VM-HDFCBK', ' - ')).toBe(false);
  });
});

describe('balanceTarget', () => {
  it('uses the bank itself, or the bank behind a debit card, never a credit card', () => {
    expect(balanceTarget(hdfcBank, all)?.id).toBe('hdfc');
    expect(balanceTarget(debit, all)?.id).toBe('hdfc');
    expect(balanceTarget(hdfcCard, all)).toBeNull();
  });
});

describe('smsHash', () => {
  const sms = { address: 'VM-HDFCBK', date: 1_790_000_000_000, body: 'Rs 100 debited' };
  it('is stable and sensitive to every field', () => {
    expect(smsHash(sms)).toBe(smsHash({ ...sms }));
    expect(smsHash(sms)).toHaveLength(28);
    expect(smsHash({ ...sms, date: sms.date + 1 })).not.toBe(smsHash(sms));
    expect(smsHash({ ...sms, body: 'Rs 101 debited' })).not.toBe(smsHash(sms));
    expect(smsHash({ ...sms, address: 'AD-SBIINB' })).not.toBe(smsHash(sms));
  });
});
