/**
 * Number, currency and date formatting. Everything is INR with Indian digit grouping
 * (₹1,24,500). There is deliberately no way to format another currency.
 *
 * Percent helpers take values in percent units (12.5 means 12.5%), which is what the
 * backend returns (`total_delta_pct`, `delta_pct`, `mape`).
 */

const LOCALE = 'en-IN';
const MINUS = '−'; // typographic minus: same width as + in tabular figures

const LAKH = 1e5;
const CRORE = 1e7;

const inrFull = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrDecimals = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const groupedInt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

const decimals = (digits: number) => new Intl.NumberFormat(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Zero or non-finite values render as a dash-free zero rather than "NaN". */
function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** ₹1,24,500 */
export function formatInr(value: number): string {
  return inrFull.format(finite(value));
}

/** ₹1,24,500.75 — for unit prices where paise matter. */
export function formatInrPrecise(value: number): string {
  return inrDecimals.format(finite(value));
}

/**
 * ₹45,200 · ₹1.2 L · ₹3.4 Cr. Indian "lakh" (1,00,000) and "crore" (1,00,00,000)
 * instead of K/M. Below one lakh the full grouped figure is shown.
 */
export function formatInrCompact(value: number): string {
  const v = finite(value);
  const abs = Math.abs(v);
  const sign = v < 0 ? MINUS : '';
  if (abs >= CRORE) {
    const crores = abs / CRORE;
    // 12,345 Cr is still readable; one decimal below 100 Cr, none above.
    const text = crores >= 100 ? groupedInt.format(Math.round(crores)) : decimals(1).format(crores).replace(/\.0$/, '');
    return `${sign}₹${text} Cr`;
  }
  if (abs >= LAKH) {
    const text = decimals(1).format(abs / LAKH).replace(/\.0$/, '');
    return `${sign}₹${text} L`;
  }
  return `${sign}₹${groupedInt.format(Math.round(abs))}`;
}

/** +₹1,200 / −₹1,200 */
export function formatInrDelta(value: number, compact = false): string {
  const v = finite(value);
  if (v === 0) return compact ? formatInrCompact(0) : formatInr(0);
  const body = compact ? formatInrCompact(Math.abs(v)) : formatInr(Math.abs(v));
  return `${v > 0 ? '+' : MINUS}${body}`;
}

/** 12.5% (value in percent units). */
export function formatPercent(value: number, digits = 1): string {
  return `${decimals(digits).format(finite(value))}%`;
}

/** +12.5% / −3.1% (value in percent units). */
export function formatSignedPercent(value: number, digits = 1): string {
  const v = finite(value);
  const rounded = Number(v.toFixed(digits));
  if (rounded === 0) return `${decimals(digits).format(0)}%`;
  return `${rounded > 0 ? '+' : MINUS}${decimals(digits).format(Math.abs(rounded))}%`;
}

/** 1,24,500 */
export function formatNumber(value: number, digits = 0): string {
  return decimals(digits).format(finite(value)).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

/** 1.2 L · 3.4 Cr for plain counts (units, rows). */
export function formatNumberCompact(value: number): string {
  return formatInrCompact(value).replace('₹', '');
}

/** Which way a change points, for badge colour. */
export type Trend = 'up' | 'down' | 'flat';

export function trendOf(value: number, epsilon = 0.05): Trend {
  const v = finite(value);
  if (Math.abs(v) < epsilon) return 'flat';
  return v > 0 ? 'up' : 'down';
}

/* ─── Dates ─── */

/** Accepts "2026-03-04" or a full ISO timestamp; returns null if unparseable. */
function parseDate(input: string | Date): Date | null {
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  // Bare dates are calendar days: pin them to noon UTC so no timezone shifts the day.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(input) ? new Date(`${input}T12:00:00Z`) : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

const dateFullUtc = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dateShortUtc = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dateFullLocal = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeLocal = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

const isBareDate = (input: string | Date) => typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input);

/** 4 Mar 2026. Bare dates keep their calendar day; timestamps show in local time. */
export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const d = parseDate(input);
  if (!d) return '—';
  return isBareDate(input) ? dateFullUtc.format(d) : dateFullLocal.format(d);
}

/** 4 Mar 2026, 3:05 pm (local time) */
export function formatDateTime(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const d = parseDate(input);
  return d ? dateTimeLocal.format(d) : '—';
}

/** 4 Mar */
export function formatDateShort(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const d = parseDate(input);
  if (!d) return '—';
  return isBareDate(input) ? dateShortUtc.format(d) : new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' }).format(d);
}
