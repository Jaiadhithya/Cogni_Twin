/**
 * Centralized formatting utilities for Cognitia Twin.
 */

/** Format a number as full currency */
export const formatCurrency = (value: number, currencyCode: string = 'USD'): string =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);

/** Format a number as compact currency */
export const formatCurrencyCompact = (value: number, currencyCode: string = 'USD'): string =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);

/** Format a delta value with +/- prefix */
export const formatDelta = (value: number, isCurrency: boolean = true, currencyCode: string = 'USD'): string => {
  const formatted = isCurrency ? formatCurrency(Math.abs(value), currencyCode) : formatNumber(Math.abs(value));
  return `${value >= 0 ? '+' : '-'}${formatted}`;
};

/** Format a percentage delta (e.g., +12.5%) */
export const formatDeltaPct = (value: number): string =>
  `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

/** Format a standard number */
export const formatNumber = (value: number, decimals = 0): string =>
  new Intl.NumberFormat(undefined, {
    maximumFractionDigits: decimals,
  }).format(value);
