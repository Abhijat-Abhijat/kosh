/**
 * On-device parser for Indian bank / card transaction SMS.
 * Pure TypeScript: no network, no native code. Returns null for anything that is not
 * a completed transaction (OTPs, promos, reminders, failed or declined attempts).
 */

export type SmsKind = 'bank' | 'card' | 'upi' | 'atm' | 'unknown';

export type ParsedSms = {
  amount: number;
  direction: 'debit' | 'credit';
  last4?: string;
  merchant?: string;
  availableBalance?: number;
  occurredAt: number;
  kind: SmsKind;
};

const CUR = String.raw`(?:rs\.?|inr|₹)`;
const NUM = String.raw`(\d[\d,]*(?:\.\d{1,2})?)`;

/** Messages that look transactional but are not completed transactions. */
const REJECT = [
  /\botp\b|one[\s-]?time[\s-]?pass(?:word|code)|verification code|\bcode is\b/i,
  /\bwill be (?:debited|charged|deducted|auto[\s-]?debited|credited)\b/i,
  /\b(?:is|are) due\b|\bdue (?:on|by|date)\b|\b(?:amt|amount|min(?:imum)?|total)\.? due\b|\breminder\b/i,
  /\b(?:failed|declined|unsuccessful|rejected|could not be|has not been|was not)\b/i,
  /\b(?:has requested|collect request|requested money|request (?:of|for) (?:rs|inr|₹))/i,
  /\b(?:pre-?approved|apply now|congratulations|limited period|exclusive offer|you are eligible|click here)\b/i,
];

const DEBIT_WORDS =
  /\b(?:debited|spent|withdrawn|withdrawal|paid|sent|deducted|purchase|txn of|transaction of|charged)\b/i;
const CREDIT_WORDS = /\b(?:credited|received|deposited|refund(?:ed)?|reversed|reversal)\b/i;

const BALANCE_PATTERNS = [
  new RegExp(
    String.raw`\b(?:avl|avbl|avail|available)\.?\s*(?:bal(?:ance)?|lmt|limit|cr(?:edit)?\.?\s*(?:lmt|limit))\.?\s*(?:is|of)?\s*[:\-]?\s*${CUR}?\s*:?\s*${NUM}`,
    'i',
  ),
  new RegExp(String.raw`\b(?:a\/c\s+)?bal(?:ance)?\.?\s*(?:is)?\s*[:\-]?\s*${CUR}\s*:?\s*${NUM}`, 'i'),
];

const AMOUNT_RE = new RegExp(String.raw`${CUR}\s*:?\s*${NUM}`, 'gi');
/** SBI UPI style: "debited by 250.0" with no currency marker. */
const BARE_AMOUNT_RE = /\b(?:debited|credited)\s+(?:by|with|for)\s+(\d[\d,]*\.\d{1,2})\b/i;

const toNumber = (s: string) => Number(s.replace(/,/g, ''));

function findBalance(text: string): number | undefined {
  for (const re of BALANCE_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      const n = toNumber(m[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function findAmount(text: string): number | undefined {
  AMOUNT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = AMOUNT_RE.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 24), m.index);
    // Skip balance / limit figures.
    if (/(?:bal(?:ance)?|lmt|limit)\.?\s*(?:is|of)?\s*[:\-]?\s*$/i.test(before)) continue;
    const n = toNumber(m[1]);
    if (n > 0) return n;
  }
  const bare = BARE_AMOUNT_RE.exec(text);
  if (bare) {
    const n = toNumber(bare[1]);
    if (n > 0) return n;
  }
  return undefined;
}

function findDirection(text: string): 'debit' | 'credit' | undefined {
  const d = DEBIT_WORDS.exec(text);
  const c = CREDIT_WORDS.exec(text);
  if (d && c) return d.index <= c.index ? 'debit' : 'credit';
  if (d) return 'debit';
  if (c) return 'credit';
  return undefined;
}

/** Account / card digits. Some banks (ICICI) mask to 3 digits; those are returned as-is. */
function findLast4(text: string): string | undefined {
  const ctx =
    /\b(?:a\/c|ac|acct|account|card|cc)\.?\s*(?:no\.?|number)?\s*(?:ending(?:\s+with|\s+in)?)?\s*[:\-]?\s*[x*#.]*\s*(\d{3,6})\b/i.exec(
      text,
    );
  if (ctx) return ctx[1].slice(-4);
  const masked = /(?:^|[\s(])[x*#]+(\d{4,6})\b/i.exec(text);
  if (masked) return masked[1].slice(-4);
  return undefined;
}

function findKind(text: string): SmsKind {
  if (/\batm\b|cash withdrawal|\bwithdrawn\b/i.test(text)) return 'atm';
  if (/\bupi\b|\bvpa\b|[\w.\-]+@[a-z]{2,}\b/i.test(text)) return 'upi';
  if (/\bcard\b/i.test(text)) return 'card';
  if (/\ba\/c\b|\bacct?\b|\baccount\b|\bneft\b|\bimps\b|\brtgs\b/i.test(text)) return 'bank';
  return 'unknown';
}

const STOP = String.raw`(?=\s+(?:has|have|is|was|credited|debited|from)\b|\s+on\b|\s+via\b|\s+ref\b|\s+refno\b|\s+upi\b|\s+txn\b|\s+avl\b|\s+avbl\b|\s+for\b|\s+using\b|\s+at\b|\s+\d{1,2}[-\/.]|[.,;:(]|\s*$)`;
const NAME = String.raw`([A-Za-z][\w&'*\-\/ ]*?)`;
const VPA = String.raw`(?:vpa\s+)?([\w.\-]+@[\w.\-]*[a-z])`;
const g = (src: string) => new RegExp(src, 'gi');

/** Ordered: the first pattern yielding an acceptable name wins. */
const DEBIT_MERCHANT: RegExp[] = [
  g(String.raw`\bto\s+${VPA}`),
  g(String.raw`\bat\s+${NAME}${STOP}`),
  g(String.raw`;\s*${NAME}\s+credited\b`),
  g(String.raw`\b(?:trf to|transferred to|to)\s+${NAME}${STOP}`),
  g(String.raw`\binfo[:\s\-]+${NAME}${STOP}`),
  g(String.raw`\bon\s+${NAME}${STOP}`),
];

const CREDIT_MERCHANT: RegExp[] = [
  g(String.raw`\bfrom\s+${VPA}`),
  g(String.raw`\binfo[:\s\-]+${NAME}${STOP}`),
  g(String.raw`\b(?:neft|imps|rtgs)\s*(?:cr|dr)?\s*[\-:\/]\s*${NAME}${STOP}`),
  g(String.raw`\b(?:by|from)\s+${NAME}${STOP}`),
];

/** Captures that describe the user's own account, a channel or a date, not a counterparty. */
const NOT_MERCHANT =
  /^(?:(?:your|you|ur|a\/c|ac|acct|account|card|the|vpa|beneficiary|bank|block|report|dispute|neft|imps|rtgs|upi|transfer|date)(?![\w\/])|(?:rs|inr)\.?\s*\d|.*\bbank\s+(?:a\/c|ac|acct|account|card|credit card|debit card)\b)/i;
const CHANNEL = /^(?:upi|p2m|p2a|imps|neft|rtgs|mmt|ach|nach|cr|dr)$/i;
const REF_LIKE = /^[a-z]*\d{4,}[a-z0-9]*$/i;

function cleanMerchant(raw: string): string | undefined {
  let s = raw.trim();
  // "UPI/P2M/629711223344/BLINKIT" -> "BLINKIT"
  if (s.includes('/') && !/^a\/c\b/i.test(s)) {
    const parts = s.split('/').map((t) => t.trim()).filter((t) => t && !CHANNEL.test(t) && !REF_LIKE.test(t));
    s = parts[parts.length - 1] ?? '';
  }
  s = s.replace(/^(?:neft|imps|rtgs|upi|mmt|ach|nach)(?:\s*(?:cr|dr))?[\s\-:]+/i, '');
  // "ACME0001234-ACME SOFTWARE PVT LTD-SALARY" -> "ACME SOFTWARE PVT LTD SALARY"
  s = s
    .split('-')
    .map((t) => t.trim())
    .filter((t) => t && !REF_LIKE.test(t))
    .join(' ')
    .replace(/[\s*]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length < 2 || NOT_MERCHANT.test(s)) return undefined;
  return s.slice(0, 40).trim();
}

function findMerchant(text: string, direction: 'debit' | 'credit'): string | undefined {
  // Trailing disclaimers ("Not you? Call 1800... to block") never hold the counterparty.
  const head = text.split(/\b(?:not you|if not (?:you|done|u)|if you did not|not done by you|call \d|sms block)\b/i)[0];
  const patterns = direction === 'debit' ? DEBIT_MERCHANT : CREDIT_MERCHANT;
  for (const re of patterns) {
    for (const m of head.matchAll(re)) {
      const name = m[1].includes('@') ? m[1] : cleanMerchant(m[1]);
      if (name) return name;
    }
  }
  return undefined;
}

/**
 * Parses one SMS body. `receivedAt` (SMS date, epoch ms) becomes occurredAt: in-body dates
 * vary too much by bank to be worth trusting over the delivery time.
 */
export function parseSms(body: string, receivedAt: number): ParsedSms | null {
  const text = body.replace(/\s+/g, ' ').trim();
  if (!text || REJECT.some((re) => re.test(text))) return null;

  const direction = findDirection(text);
  if (!direction) return null;
  const amount = findAmount(text);
  if (amount === undefined) return null;

  const kind = findKind(text);
  let merchant = findMerchant(text, direction);
  if (!merchant && kind === 'atm') merchant = 'ATM';

  const result: ParsedSms = { amount, direction, occurredAt: receivedAt, kind };
  const last4 = findLast4(text);
  if (last4) result.last4 = last4;
  if (merchant) result.merchant = merchant;
  const availableBalance = findBalance(text);
  if (availableBalance !== undefined) result.availableBalance = availableBalance;
  return result;
}
