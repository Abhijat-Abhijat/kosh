import { categorize } from '../categorize';
import { parseSms } from '../parser';

describe('categorize: debits by merchant', () => {
  it.each([
    ['SWIGGY', 'Food & Dining'],
    ['zomato-order@ptybl', 'Food & Dining'],
    ['SWIGGY INSTAMART', 'Groceries'],
    ['BLINKIT', 'Groceries'],
    ['DMART AVENUE', 'Groceries'],
    ['UBER INDIA', 'Transport'],
    ['OLA CABS', 'Transport'],
    ['UBER EATS', 'Food & Dining'],
    ['NETFLIX', 'Subscriptions'],
    ['spotify.in@hdfcbank', 'Subscriptions'],
    ['AMAZON PRIME VIDEO', 'Subscriptions'],
    ['AMAZON', 'Shopping'],
    ['RELIANCE DIGITAL', 'Shopping'],
    ['MAKEMYTRIP', 'Travel'],
    ['HPCL PETROL PUMP', 'Fuel'],
    ['AIRTEL PREPAID', 'Bills & Utilities'],
    ['LIC OF INDIA', 'Insurance'],
    ['APOLLO PHARMACY', 'Health'],
    ['BOOKMYSHOW', 'Entertainment'],
    ['ZERODHA BROKING', 'Investments'],
    ['SUNRISE RENT', 'Rent'],
  ])('%s -> %s', (merchant, expected) => {
    expect(categorize({ merchant, direction: 'debit' })).toBe(expected);
  });

  it('matches short keywords only as whole words', () => {
    expect(categorize({ merchant: 'COLA HOUSE', direction: 'debit' })).toBeNull();
    expect(categorize({ merchant: 'VIKRAM', direction: 'debit' })).toBeNull();
    expect(categorize({ merchant: 'LICORICE', direction: 'debit' })).toBeNull();
  });

  it('maps ATM withdrawals to Cash Withdrawal', () => {
    expect(categorize({ direction: 'debit', kind: 'atm' })).toBe('Cash Withdrawal');
    expect(categorize({ merchant: 'SBI ATM S1BW000123', direction: 'debit' })).toBe('Cash Withdrawal');
  });

  it('returns null for unknown merchants and missing merchant', () => {
    expect(categorize({ merchant: 'MEERA NAIR', direction: 'debit' })).toBeNull();
    expect(categorize({ direction: 'debit' })).toBeNull();
  });
});

describe('categorize: credits', () => {
  it('detects salary, interest and refunds from merchant or body', () => {
    expect(categorize({ merchant: 'ACME SOFTWARE PVT LTD SALARY OCT 2026', direction: 'credit' })).toBe('Salary');
    expect(categorize({ direction: 'credit', body: 'INR 432.00 credited towards Savings Interest' })).toBe('Interest');
    expect(categorize({ merchant: 'FLIPKART', direction: 'credit', body: 'Refund of INR 1,099.00 from FLIPKART' })).toBe(
      'Refund',
    );
  });

  it('does not apply expense keywords to credits', () => {
    expect(categorize({ merchant: 'SWIGGY', direction: 'credit' })).toBeNull();
  });
});

describe('parse + categorize', () => {
  it('categorizes a parsed card spend', () => {
    const body = 'Spent Rs 1,234.00 on HDFC Bank Card xx1234 at ZOMATO on 2026-10-12:14:22:05. Avl Lmt: Rs 84,321.50';
    const p = parseSms(body, 0)!;
    expect(categorize({ ...p, body })).toBe('Food & Dining');
  });
});
