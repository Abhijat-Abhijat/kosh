import type { SmsKind } from './parser';

/** Built-in category names, as seeded in src/lib/db/migrations.ts. */
export type BuiltInCategory =
  | 'Food & Dining'
  | 'Groceries'
  | 'Shopping'
  | 'Transport'
  | 'Fuel'
  | 'Bills & Utilities'
  | 'Rent'
  | 'Health'
  | 'Education'
  | 'Entertainment'
  | 'Subscriptions'
  | 'Travel'
  | 'Insurance'
  | 'Investments'
  | 'Transfer'
  | 'Cash Withdrawal'
  | 'Salary'
  | 'Interest'
  | 'Refund'
  | 'Other';

/**
 * Ordered keyword rules for debits; first match wins, so more specific brands come
 * before broad ones (INSTAMART before SWIGGY, PRIME VIDEO before AMAZON).
 * Keywords up to 4 chars must match as whole words; longer ones match as substrings
 * so VPAs like "swiggy.stores@axb" still hit.
 */
const DEBIT_RULES: [BuiltInCategory, string[]][] = [
  [
    'Subscriptions',
    ['NETFLIX', 'SPOTIFY', 'HOTSTAR', 'PRIME VIDEO', 'AMAZON PRIME', 'PRIMEVIDEO', 'YOUTUBE', 'YOUTUBEPREMIUM',
      'APPLE.COM', 'ITUNES', 'SONYLIV', 'ZEE5', 'JIOCINEMA', 'JIOHOTSTAR', 'AUDIBLE', 'OPENAI', 'CHATGPT',
      'GOOGLE ONE', 'ICLOUD', 'LINKEDIN', 'GAANA', 'WYNK'],
  ],
  [
    'Groceries',
    ['INSTAMART', 'BIGBASKET', 'BLINKIT', 'GROFERS', 'ZEPTO', 'DMART', 'JIOMART', 'MORE RETAIL', 'RELIANCE FRESH',
      'SMART BAZAAR', 'NATURES BASKET', 'SPENCERS', 'SUPERMARKET', 'KIRANA', 'MILKBASKET', 'COUNTRY DELIGHT'],
  ],
  [
    'Food & Dining',
    ['SWIGGY', 'ZOMATO', 'UBER EATS', 'EATSURE', 'DOMINOS', 'MCDONALD', 'KFC', 'PIZZA', 'BURGER', 'STARBUCKS',
      'CHAAYOS', 'HALDIRAM', 'SUBWAY', 'BARBEQUE', 'RESTAURANT', 'CAFE', 'BAKERY', 'DHABA', 'BIRYANI'],
  ],
  [
    'Fuel',
    ['PETROL', 'FUEL', 'HPCL', 'BPCL', 'IOCL', 'INDIAN OIL', 'BHARAT PETROLEUM', 'HINDUSTAN PETROLEUM', 'SHELL',
      'NAYARA', 'FILLING STATION'],
  ],
  [
    'Travel',
    ['IRCTC', 'MAKEMYTRIP', 'GOIBIBO', 'CLEARTRIP', 'YATRA', 'EASEMYTRIP', 'IXIGO', 'REDBUS', 'INDIGO', 'AIR INDIA',
      'AIRINDIA', 'VISTARA', 'AKASA', 'SPICEJET', 'OYO', 'AIRBNB', 'BOOKING.COM', 'AGODA', 'TAJ HOTELS'],
  ],
  [
    'Transport',
    ['UBER', 'OLA', 'OLACABS', 'RAPIDO', 'NAMMA YATRI', 'BLUSMART', 'METRO', 'FASTAG', 'PARKING', 'BMTC', 'BEST',
      'TOLL'],
  ],
  [
    'Shopping',
    ['AMAZON', 'AMZN', 'FLIPKART', 'MYNTRA', 'AJIO', 'MEESHO', 'NYKAA', 'TATACLIQ', 'TATA CLIQ', 'SNAPDEAL',
      'DECATHLON', 'IKEA', 'CROMA', 'RELIANCE DIGITAL', 'RELIANCE TRENDS', 'LIFESTYLE', 'SHOPPERS STOP',
      'WESTSIDE', 'ZUDIO', 'PANTALOONS', 'H&M', 'UNIQLO', 'LENSKART', 'FIRSTCRY'],
  ],
  [
    'Bills & Utilities',
    ['ELECTRICITY', 'BESCOM', 'MSEDCL', 'TATA POWER', 'ADANI ELECTRICITY', 'TORRENT POWER', 'BSES', 'TNEB',
      'AIRTEL', 'JIO', 'VODAFONE', 'VI', 'BSNL', 'ACT FIBERNET', 'HATHWAY', 'BROADBAND', 'RECHARGE', 'DTH',
      'TATA PLAY', 'BILLDESK', 'INDANE', 'BHARATGAS', 'GAS', 'WATER', 'MAINTENANCE', 'MYGATE'],
  ],
  ['Rent', ['RENT', 'NOBROKER', 'HOUSING.COM', 'NESTAWAY']],
  [
    'Health',
    ['PHARMACY', 'PHARMEASY', 'APOLLO', 'MEDPLUS', '1MG', 'TATA 1MG', 'NETMEDS', 'HOSPITAL', 'CLINIC', 'PRACTO',
      'DIAGNOSTIC', 'LAB', 'MEDICAL', 'CHEMIST', 'CULT.FIT', 'CULTFIT', 'GYM'],
  ],
  [
    'Education',
    ['SCHOOL', 'COLLEGE', 'UNIVERSITY', 'UDEMY', 'COURSERA', 'BYJU', 'UNACADEMY', 'VEDANTU', 'TUITION',
      'FEES'],
  ],
  [
    'Entertainment',
    ['BOOKMYSHOW', 'PVR', 'INOX', 'CINEPOLIS', 'DISTRICT', 'PAYTM INSIDER', 'STEAM', 'PLAYSTATION', 'XBOX',
      'DREAM11', 'WONDERLA'],
  ],
  [
    'Insurance',
    ['INSURANCE', 'LIC', 'LIFE INSURANCE', 'POLICYBAZAAR', 'HDFC LIFE', 'ICICI PRU', 'ICICI LOMBARD', 'SBI LIFE',
      'STAR HEALTH', 'NIVA BUPA', 'CARE HEALTH', 'ACKO', 'DIGIT', 'TATA AIG', 'BAJAJ ALLIANZ'],
  ],
  [
    'Investments',
    ['ZERODHA', 'GROWW', 'UPSTOX', 'KUVERA', 'ANGEL ONE', 'INDMONEY', 'PAYTM MONEY', 'COIN', 'MUTUAL FUND',
      'SIP', 'NPS', 'PPF', 'BSE LTD', 'NSE CLEARING', 'ICCL', 'CAMS', 'KFINTECH', 'SMALLCASE'],
  ],
];

const CREDIT_RULES: [BuiltInCategory, RegExp][] = [
  ['Salary', /\b(?:salary|sal for|payroll|sal cr)\b/i],
  ['Interest', /\b(?:interest|int\.? (?:pd|cr|credit))\b/i],
  ['Refund', /\b(?:refund(?:ed)?|reversal|reversed|cashback|cash back)\b/i],
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const compiled: [BuiltInCategory, RegExp][] = DEBIT_RULES.map(([cat, words]) => {
  const alts = words.map((w) => {
    const e = escape(w);
    return w.length <= 4 ? `(?:^|[^A-Z0-9])${e}(?=[^A-Z0-9]|$)` : e;
  });
  return [cat, new RegExp(alts.join('|'))];
});

/** Maps a parsed SMS to a built-in category name, or null when nothing fits. */
export function categorize(input: {
  merchant?: string;
  direction: 'debit' | 'credit';
  kind?: SmsKind;
  body?: string;
}): BuiltInCategory | null {
  const merchant = (input.merchant ?? '').toUpperCase();
  if (input.direction === 'credit') {
    const text = `${merchant} ${input.body ?? ''}`;
    for (const [cat, re] of CREDIT_RULES) if (re.test(text)) return cat;
    return null;
  }
  if (input.kind === 'atm' || /\bATM\b/.test(merchant)) return 'Cash Withdrawal';
  if (!merchant) return null;
  for (const [cat, re] of compiled) if (re.test(merchant)) return cat;
  return null;
}
