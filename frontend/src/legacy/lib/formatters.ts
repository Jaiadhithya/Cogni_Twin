/**
 * Centralized formatting utilities for Cognitia Twin.
 *
 * The platform is INR-denominated retail analytics, so currency helpers default
 * to Indian Rupees with Indian grouping (e.g. ₹2,50,000). Call sites must never
 * mix currencies.
 */

/** Locale used for currency/number grouping (Indian numbering system). */
const IN_LOCALE = 'en-IN';

/** Format a number as full currency */
export const formatCurrency = (value: number, currencyCode: string = 'INR'): string =>
  new Intl.NumberFormat(IN_LOCALE, {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);

/** Format a number as compact currency */
export const formatCurrencyCompact = (value: number, currencyCode: string = 'INR'): string =>
  new Intl.NumberFormat(IN_LOCALE, {
    style: 'currency',
    currency: currencyCode,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);

/** Format a delta value with +/- prefix */
export const formatDelta = (value: number, isCurrency: boolean = true, currencyCode: string = 'INR'): string => {
  const formatted = isCurrency ? formatCurrency(Math.abs(value), currencyCode) : formatNumber(Math.abs(value));
  return `${value >= 0 ? '+' : '-'}${formatted}`;
};

/** Format a percentage delta (e.g., +12.5%) */
export const formatDeltaPct = (value: number): string =>
  `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

/** Format a standard number */
export const formatNumber = (value: number, decimals = 0): string =>
  new Intl.NumberFormat(IN_LOCALE, {
    maximumFractionDigits: decimals,
  }).format(value);
