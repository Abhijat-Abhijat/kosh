import type { AccountKind, TxnDirection } from '@/types/db';

/**
 * Change to `accounts.balance` for a transaction on an account of `kind`.
 * Bank/cash/wallet hold available money; credit cards hold outstanding, so a debit grows it.
 */
export function balanceDelta(kind: AccountKind, direction: TxnDirection, amount: number) {
  const signed = direction === 'debit' ? -amount : amount;
  return kind === 'credit_card' ? -signed : signed;
}
