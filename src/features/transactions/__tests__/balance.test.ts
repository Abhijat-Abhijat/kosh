import { balanceDelta } from '../balance';

it('debits reduce cash/bank and grow card outstanding', () => {
  expect(balanceDelta('cash', 'debit', 100)).toBe(-100);
  expect(balanceDelta('bank', 'credit', 100)).toBe(100);
  expect(balanceDelta('credit_card', 'debit', 100)).toBe(100);
  expect(balanceDelta('credit_card', 'credit', 100)).toBe(-100);
});
