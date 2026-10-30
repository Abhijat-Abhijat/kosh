import { z } from 'zod';

import type { Holding, HoldingInsert, HoldingKind, PayFrequency } from '@/types/db';
import { isISODate } from './calc';
import { GOLD_ESTIMATE } from './prices';

export const KIND_LABEL: Record<HoldingKind, string> = {
  fd: 'Fixed Deposits',
  rd: 'Recurring Deposits',
  stock: 'Stocks',
  mutual_fund: 'Mutual Funds',
  gold: 'Digital Gold',
  lic: 'LIC Policies',
  ppf: 'PPF',
  other: 'Other',
};

export const KIND_SHORT: Record<HoldingKind, string> = {
  fd: 'FD',
  rd: 'RD',
  stock: 'Stock',
  mutual_fund: 'Mutual fund',
  gold: 'Gold',
  lic: 'LIC',
  ppf: 'PPF',
  other: 'Other',
};

export const FREQ_OPTIONS: { value: PayFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half-yearly' },
  { value: 'yearly', label: 'Yearly' },
];

const isNum = (v: string) => v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0;
const num = z.string().trim().min(1, 'Required').refine(isNum, 'Enter a number');
const optNum = z.string().trim().refine((v) => v === '' || isNum(v), 'Enter a number');
const date = z.string().trim().refine(isISODate, 'Use YYYY-MM-DD');
const optDate = z.string().trim().refine((v) => v === '' || isISODate(v), 'Use YYYY-MM-DD');
const req = z.string().trim().min(1, 'Required');
const freq = z.enum(['monthly', 'quarterly', 'half_yearly', 'yearly']);
const after = (v: { start: string; maturity: string }) => !v.start || !v.maturity || v.maturity > v.start;
const afterMsg = { message: 'Must be after start', path: ['maturity'] };
const base = { name: z.string().trim(), notes: z.string().trim() };

export const holdingSchema = z.discriminatedUnion('kind', [
  z
    .object({ ...base, kind: z.literal('fd'), institution: req, invested: num, rate: num, start: date, maturity: date, compounding: freq })
    .refine(after, afterMsg),
  z
    .object({
      ...base,
      kind: z.literal('rd'),
      institution: req,
      instalment: num,
      rate: num,
      start: date,
      maturity: date,
      day: z
        .string()
        .trim()
        .refine((v) => v === '' || (Number.isInteger(Number(v)) && +v >= 1 && +v <= 31), '1 to 31'),
      accountId: z.string(),
    })
    .refine(after, afterMsg),
  z.object({
    ...base,
    kind: z.literal('stock'),
    symbol: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9&_.-]+$/, 'Like RELIANCE.NS'),
    units: num,
    price: num,
  }),
  z.object({ ...base, kind: z.literal('mutual_fund'), name: req, symbol: z.string().trim().regex(/^\d*$/, 'Digits only'), units: optNum, invested: num }),
  z
    .object({
      ...base,
      kind: z.literal('gold'),
      institution: z.string().trim(),
      units: num,
      invested: num,
      priceSource: z.enum(['estimate', 'manual']),
      price: optNum,
    })
    .refine((v) => v.priceSource === 'estimate' || v.price !== '', { message: 'Enter price per gram', path: ['price'] }),
  z
    .object({
      ...base,
      kind: z.literal('lic'),
      name: req,
      instalment: num,
      frequency: freq,
      start: date,
      maturity: date,
      sumAssured: optNum,
      currentValue: optNum,
    })
    .refine(after, afterMsg),
  ...(['ppf', 'other'] as const).map((k) =>
    z
      .object({ ...base, kind: z.literal(k), name: req, invested: num, currentValue: optNum, rate: optNum, start: optDate, maturity: optDate })
      .refine(after, afterMsg),
  ),
]);

export type HoldingParsed = z.output<typeof holdingSchema>;

/** Flat string form state shared by every kind; the schema picks what applies. */
export type HoldingForm = {
  kind: HoldingKind;
  name: string;
  notes: string;
  institution: string;
  symbol: string;
  units: string;
  invested: string;
  price: string;
  rate: string;
  compounding: PayFrequency;
  start: string;
  maturity: string;
  instalment: string;
  day: string;
  frequency: PayFrequency;
  sumAssured: string;
  currentValue: string;
  accountId: string;
  priceSource: 'estimate' | 'manual';
};

export const emptyForm = (kind: HoldingKind = 'fd'): HoldingForm => ({
  kind,
  name: '',
  notes: '',
  institution: '',
  symbol: '',
  units: '',
  invested: '',
  price: '',
  rate: '',
  compounding: 'quarterly',
  start: '',
  maturity: '',
  instalment: '',
  day: '',
  frequency: 'yearly',
  sumAssured: '',
  currentValue: '',
  accountId: '',
  priceSource: 'estimate',
});

const n = (v: string) => (v === '' ? null : Number(v));
const s = (v: string) => (v === '' ? null : v);

/** Columns a form controls, nulled so editing never leaves stale values. Prices are kept for market kinds. */
const CLEAR = {
  institution: null,
  symbol: null,
  units: null,
  interest_rate: null,
  compounding: null,
  start_date: null,
  maturity_date: null,
  installment_amount: null,
  installment_day: null,
  premium_frequency: null,
  sum_assured: null,
  account_id: null,
} satisfies Partial<HoldingInsert>;

export function toInsert(v: HoldingParsed): HoldingInsert {
  const common = { ...CLEAR, kind: v.kind, notes: s(v.notes) };
  switch (v.kind) {
    case 'fd':
      return {
        ...common,
        name: v.name || `${v.institution} FD`,
        institution: v.institution,
        invested_amount: Number(v.invested),
        interest_rate: Number(v.rate),
        start_date: v.start,
        maturity_date: v.maturity,
        compounding: v.compounding,
      };
    case 'rd':
      return {
        ...common,
        name: v.name || `${v.institution} RD`,
        institution: v.institution,
        installment_amount: Number(v.instalment),
        interest_rate: Number(v.rate),
        start_date: v.start,
        maturity_date: v.maturity,
        installment_day: n(v.day),
        premium_frequency: 'monthly',
        account_id: s(v.accountId),
        invested_amount: 0, // filled in by computedFields
      };
    case 'stock':
      return {
        ...common,
        name: v.name || v.symbol.replace(/\.(NS|BO)$/, ''),
        symbol: v.symbol,
        units: Number(v.units),
        invested_amount: Math.round(Number(v.units) * Number(v.price) * 100) / 100,
      };
    case 'mutual_fund':
      return { ...common, name: v.name, symbol: s(v.symbol), units: n(v.units), invested_amount: Number(v.invested) };
    case 'gold': {
      const manual = v.priceSource === 'manual';
      const price = manual ? Number(v.price) : null;
      return {
        ...common,
        name: v.name || (v.institution ? `${v.institution} Gold` : 'Digital Gold'),
        institution: s(v.institution),
        units: Number(v.units),
        invested_amount: Number(v.invested),
        symbol: manual ? null : GOLD_ESTIMATE,
        current_price: price,
        current_value: price != null ? Math.round(price * Number(v.units) * 100) / 100 : null,
        price_updated_at: manual ? new Date().toISOString() : null,
      };
    }
    case 'lic':
      return {
        ...common,
        name: v.name,
        installment_amount: Number(v.instalment),
        premium_frequency: v.frequency,
        start_date: v.start,
        maturity_date: v.maturity,
        sum_assured: n(v.sumAssured),
        current_value: n(v.currentValue),
        invested_amount: 0, // filled in by computedFields
      };
    default:
      return {
        ...common,
        name: v.name,
        invested_amount: Number(v.invested),
        current_value: n(v.currentValue),
        interest_rate: n(v.rate),
        start_date: s(v.start),
        maturity_date: s(v.maturity),
      };
  }
}

export function fromHolding(h: Holding): HoldingForm {
  const str = (x: number | string | null) => (x == null ? '' : String(x));
  return {
    ...emptyForm(h.kind),
    name: h.name,
    notes: h.notes ?? '',
    institution: h.institution ?? '',
    symbol: h.symbol === GOLD_ESTIMATE ? '' : (h.symbol ?? ''),
    units: str(h.units),
    invested: str(h.invested_amount),
    price:
      h.kind === 'stock'
        ? h.units
          ? String(Math.round((h.invested_amount / h.units) * 100) / 100)
          : ''
        : str(h.current_price),
    rate: str(h.interest_rate),
    compounding: h.compounding ?? 'quarterly',
    start: h.start_date ?? '',
    maturity: h.maturity_date ?? '',
    instalment: str(h.installment_amount),
    day: str(h.installment_day),
    frequency: h.premium_frequency ?? 'yearly',
    sumAssured: str(h.sum_assured),
    currentValue: str(h.current_value),
    accountId: h.account_id ?? '',
    priceSource: h.kind === 'gold' && h.symbol !== GOLD_ESTIMATE ? 'manual' : 'estimate',
  };
}
