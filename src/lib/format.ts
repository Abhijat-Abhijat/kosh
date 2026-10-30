const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/**
 * Splits an amount into display parts for the design's "₹1,84,320.0" style,
 * where the fraction digit is rendered faded.
 */
export function moneyParts(amount: number, opts: { sign?: boolean } = {}) {
  const abs = Math.abs(amount);
  const whole = Math.trunc(abs);
  const fraction = Math.round((abs - whole) * 10) % 10;
  const sign = amount < 0 ? '−' : opts.sign && amount > 0 ? '+' : '';
  return { sign, whole: `₹${inr.format(whole)}`, fraction: `.${fraction}` };
}

export function formatMoney(amount: number) {
  const p = moneyParts(amount);
  return `${p.sign}${p.whole}`;
}

export function formatDate(d: string | Date, withYear = false) {
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

export function formatTime(d: string | Date) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/** ISO date (YYYY-MM-DD) in local time, for Postgres `date` columns. */
export function toISODate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
