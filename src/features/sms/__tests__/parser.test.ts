import { parseSms } from '../parser';

// All messages are synthetic: made-up names, numbers and references.
const T = 1_790_000_000_000;

type Case = {
  name: string;
  body: string;
  expect: Record<string, unknown>;
};

const transactions: Case[] = [
  {
    name: 'HDFC UPI sent',
    body: 'Sent Rs.450.00 From HDFC Bank A/C *4821 To SWIGGY On 12/10/26 Ref 629183746512 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808',
    expect: { amount: 450, direction: 'debit', last4: '4821', merchant: 'SWIGGY', kind: 'upi' },
  },
  {
    name: 'HDFC UPI debited to VPA',
    body: 'Rs.1,200.00 has been debited from account **4821 to VPA ravi.k@okicici RAVI KUMAR on 12-10-26. Your UPI transaction reference number is 629100012345.',
    expect: { amount: 1200, direction: 'debit', last4: '4821', merchant: 'ravi.k@okicici', kind: 'upi' },
  },
  {
    name: 'HDFC credit card spend',
    body: 'Spent Rs 1,234.00 on HDFC Bank Card xx1234 at AMAZON on 2026-10-12:14:22:05. Avl Lmt: Rs 84,321.50. Not you? Call 18002586161',
    expect: {
      amount: 1234,
      direction: 'debit',
      last4: '1234',
      merchant: 'AMAZON',
      availableBalance: 84321.5,
      kind: 'card',
    },
  },
  {
    name: 'HDFC debit card POS',
    body: 'Rs.689.40 spent on HDFC Bank Debit Card xx9087 at DMART AVENUE on 11-10-26. Avl bal: Rs.23,456.10',
    expect: {
      amount: 689.4,
      direction: 'debit',
      last4: '9087',
      merchant: 'DMART AVENUE',
      availableBalance: 23456.1,
      kind: 'card',
    },
  },
  {
    name: 'HDFC UPI credit from VPA',
    body: 'Money Received - INR 2,500.00 in your HDFC Bank A/c xx4821 on 09-10-26 from VPA asha.m@okaxis (UPI Ref No 629011223344)',
    expect: { amount: 2500, direction: 'credit', last4: '4821', merchant: 'asha.m@okaxis', kind: 'upi' },
  },
  {
    name: 'HDFC salary NEFT credit',
    body: 'Update! INR 85,000.00 deposited in HDFC Bank A/c XX4821 on 01-OCT-26 for NEFT Cr-ACME0001234-ACME SOFTWARE PVT LTD-SALARY OCT 2026.Avl bal INR 1,12,450.75',
    expect: {
      amount: 85000,
      direction: 'credit',
      last4: '4821',
      merchant: 'ACME SOFTWARE PVT LTD SALARY OCT 2026',
      availableBalance: 112450.75,
      kind: 'bank',
    },
  },
  {
    name: 'SBI account debit transfer',
    body: 'Dear Customer, Your A/C XXXXX56789 has a debit by transfer of Rs 3,000.00 on 05Oct26. Your A/C XXXXX56789 debited INR 3,000.00 on 05/10/26 -Transferred to MEERA NAIR. Avl Balance INR 14,250.00-SBI',
    expect: { amount: 3000, direction: 'debit', last4: '6789', merchant: 'MEERA NAIR', availableBalance: 14250, kind: 'bank' },
  },
  {
    name: 'SBI UPI without currency',
    body: 'Dear UPI user A/C X3344 debited by 250.0 on date 12Oct26 trf to ZOMATO Refno 629887766554. If not u? call 1800111109. -SBI',
    expect: { amount: 250, direction: 'debit', last4: '3344', merchant: 'ZOMATO', kind: 'upi' },
  },
  {
    name: 'SBI UPI credit',
    body: 'Dear SBI UPI User, ur A/cX3344 credited by Rs500 on 08Oct26 by (Ref no 629812345678)',
    expect: { amount: 500, direction: 'credit', last4: '3344', kind: 'upi' }, // no counterparty in this format,
  },
  {
    name: 'SBI ATM withdrawal',
    body: 'Dear Customer, Rs.5,000 withdrawn at SBI ATM S1BW000123 from A/cX3344 on 10Oct26 Transaction Number 4567. Available Balance Rs.9,250.40. If not withdrawn by you, call 1800111109',
    expect: { amount: 5000, direction: 'debit', last4: '3344', merchant: 'SBI ATM S1BW000123', kind: 'atm' },
  },
  {
    name: 'ICICI UPI debit with merchant credited',
    body: 'ICICI Bank Acct XX765 debited for Rs 349.00 on 12-Oct-26; UBER INDIA credited. UPI:629900112233. Call 18002662 for dispute. SMS BLOCK 765 to 9215676766.',
    expect: { amount: 349, direction: 'debit', last4: '765', merchant: 'UBER INDIA', kind: 'upi' },
  },
  {
    name: 'ICICI credit card spend',
    body: 'INR 649.00 spent using ICICI Bank Card XX5521 on 10-Oct-26 on NETFLIX. Avl Limit: INR 1,45,210.00. If not you, call 1800 2662/SMS BLOCK 5521 to 9215676766',
    expect: { amount: 649, direction: 'debit', last4: '5521', merchant: 'NETFLIX', availableBalance: 145210, kind: 'card' },
  },
  {
    name: 'ICICI NEFT credit',
    body: 'Dear Customer, Acct XX7654 is credited with Rs 12,000.00 on 03-Oct-26 from GLOBEX TRADERS. NEFT Ref ICICN62970011. -ICICI Bank',
    expect: { amount: 12000, direction: 'credit', last4: '7654', merchant: 'GLOBEX TRADERS', kind: 'bank' },
  },
  {
    name: 'Axis debit card spend',
    body: 'INR 2,150.00 spent on Axis Bank Card no. XX8899 at RELIANCE DIGITAL on 07-10-26 at 18:41:09 IST. Avl Lmt INR 58,000.00. Not you? SMS BLOCK 8899 to 919951860002',
    expect: {
      amount: 2150,
      direction: 'debit',
      last4: '8899',
      merchant: 'RELIANCE DIGITAL',
      availableBalance: 58000,
      kind: 'card',
    },
  },
  {
    name: 'Axis account debit UPI',
    body: 'INR 120.00 debited from A/c no. XX2233 on 06-10-26 at 09:12:44 IST. Info- UPI/P2M/629711223344/BLINKIT. Avl Bal INR 7,880.25',
    expect: { amount: 120, direction: 'debit', last4: '2233', merchant: 'BLINKIT', availableBalance: 7880.25, kind: 'upi' },
  },
  {
    name: 'Axis IMPS credit',
    body: 'INR 15,000.00 credited to A/c no. XX2233 on 04-10-26 at 11:05:00 IST. Info- IMPS/P2A/629700001111/VIKRAM. Avl Bal INR 22,880.25',
    expect: { amount: 15000, direction: 'credit', last4: '2233', merchant: 'VIKRAM', availableBalance: 22880.25, kind: 'bank' },
  },
  {
    name: 'Kotak UPI sent',
    body: 'Sent Rs.799.00 from Kotak Bank AC X4455 to spotify.in@hdfcbank on 02-10-26.UPI Ref 629644556677. Not you, https://kotak.com/KBANKT/Fraud',
    expect: { amount: 799, direction: 'debit', last4: '4455', merchant: 'spotify.in@hdfcbank', kind: 'upi' },
  },
  {
    name: 'Kotak UPI received',
    body: 'Received Rs.300.00 in your Kotak Bank AC X4455 from priya.s@okhdfcbank on 01-10-26.UPI Ref:629633221100.',
    expect: { amount: 300, direction: 'credit', last4: '4455', merchant: 'priya.s@okhdfcbank', kind: 'upi' },
  },
  {
    name: 'Kotak card transaction with rupee symbol',
    body: 'Transaction of ₹3,499.00 on Kotak Credit Card XX6677 at MAKEMYTRIP on 29-09-2026. Avl limit ₹41,200.00',
    expect: {
      amount: 3499,
      direction: 'debit',
      last4: '6677',
      merchant: 'MAKEMYTRIP',
      availableBalance: 41200,
      kind: 'card',
    },
  },
  {
    name: 'Card bill payment received',
    body: 'Payment of Rs 25,000.00 received towards your HDFC Bank Credit Card ending 1234 on 28-09-26. Thank you.',
    expect: { amount: 25000, direction: 'credit', last4: '1234', kind: 'card' },
  },
  {
    name: 'Refund credit',
    body: 'Refund of INR 1,099.00 from FLIPKART has been credited to your ICICI Bank Credit Card XX5521 on 27-Sep-26.',
    expect: { amount: 1099, direction: 'credit', last4: '5521', merchant: 'FLIPKART', kind: 'card' },
  },
  {
    name: 'ATM withdrawal HDFC',
    body: 'Rs.2000 withdrawn from HDFC Bank Card x9087 at ATM-MG ROAD BLR on 2026-09-26:20:11:43. Avl bal: Rs.18,000.00',
    expect: { amount: 2000, direction: 'debit', last4: '9087', merchant: 'ATM MG ROAD BLR', kind: 'atm' },
  },
  {
    name: 'Interest credit',
    body: 'Dear Customer, INR 432.00 credited to your A/c XX4821 on 30-09-26 towards Savings Interest. Avl Bal: INR 1,12,882.75',
    expect: { amount: 432, direction: 'credit', last4: '4821', availableBalance: 112882.75, kind: 'bank' },
  },
  {
    name: 'Rs without dot or space',
    body: 'Your a/c no. XXXXXXXX1111 is debited for Rs2,345.67 on 25-09-26 by NACH to LIC OF INDIA. Avl bal Rs10,000.00',
    expect: { amount: 2345.67, direction: 'debit', last4: '1111', merchant: 'LIC OF INDIA', availableBalance: 10000 },
  },
  {
    name: 'INR with colon and lakh commas',
    body: 'Amount INR: 1,50,000.00 debited from A/c XX4821 on 20-09-26 via RTGS to SUNRISE PROPERTIES. Avl Bal: INR 62,450.00',
    expect: { amount: 150000, direction: 'debit', last4: '4821', kind: 'bank' },
  },
];

const rejects: { name: string; body: string }[] = [
  { name: 'OTP', body: '482913 is your OTP for txn of Rs 1,499.00 at AMAZON on HDFC Bank Card xx1234. Valid for 5 mins. Do not share.' },
  { name: 'OTP wording', body: 'Use One Time Password 771204 to complete your purchase of INR 2,000 on Axis Bank Card XX8899.' },
  { name: 'auto-debit reminder', body: 'Dear Customer, Rs 649.00 will be debited from your HDFC Bank A/c XX4821 on 15-10-26 towards NETFLIX standing instruction.' },
  { name: 'card bill due', body: 'Your ICICI Bank Credit Card XX5521 statement: Total Amt Due Rs 12,450.00, Min Amt Due Rs 620.00. Due date 05-Nov-26.' },
  { name: 'promo', body: 'Congratulations! You are eligible for a pre-approved personal loan of Rs 5,00,000. Apply now at https://example.com' },
  { name: 'declined', body: 'Your transaction of Rs 3,200.00 on Kotak Credit Card XX6677 at CROMA was declined due to insufficient limit.' },
  { name: 'failed UPI', body: 'UPI transaction of Rs 500.00 to zomato@hdfcbank has failed. Amount if debited will be refunded within 3 days.' },
  { name: 'collect request', body: 'ravi.k@okicici has requested money of Rs 750.00 from you on Google Pay. Approve to pay.' },
  { name: 'balance enquiry only', body: 'Your A/c XX4821 balance as on 12-10-26 is INR 45,210.00. HDFC Bank' },
];

describe('parseSms: transactions', () => {
  it.each(transactions)('$name', ({ body, expect: exp }) => {
    const r = parseSms(body, T);
    expect(r).not.toBeNull();
    expect(r).toMatchObject({ ...exp, occurredAt: T });
  });
});

describe('parseSms: non-transactions return null', () => {
  it.each(rejects)('$name', ({ body }) => {
    expect(parseSms(body, T)).toBeNull();
  });
});

describe('parseSms: details', () => {
  it('does not take the balance as the amount when balance appears first', () => {
    const r = parseSms('Avl Bal Rs 9,000.00 after Rs 1,000.00 debited from A/c XX4821 to KIRAN.', T);
    expect(r?.amount).toBe(1000);
    expect(r?.availableBalance).toBe(9000);
  });

  it('omits optional fields when absent', () => {
    const r = parseSms('Rs 100 debited from your account.', T);
    expect(r).toEqual({ amount: 100, direction: 'debit', occurredAt: T, kind: 'bank' });
  });

  it('returns null for empty or amount-less text', () => {
    expect(parseSms('', T)).toBeNull();
    expect(parseSms('Your account has been debited.', T)).toBeNull();
  });
});
