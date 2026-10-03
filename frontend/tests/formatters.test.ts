import {
  formatDate,
  formatDateShort,
  formatInr,
  formatInrCompact,
  formatInrDelta,
  formatInrPrecise,
  formatNumber,
  formatNumberCompact,
  formatPercent,
  formatSignedPercent,
  trendOf,
} from '../src/lib/formatters';

describe('INR formatting', () => {
  it('groups digits the Indian way', () => {
    expect(formatInr(124500)).toBe('₹1,24,500');
    expect(formatInr(12345678)).toBe('₹1,23,45,678');
    expect(formatInr(999)).toBe('₹999');
    expect(formatInr(0)).toBe('₹0');
  });

  it('keeps paise when asked', () => {
    expect(formatInrPrecise(1234.5)).toBe('₹1,234.50');
  });

  it('never shows NaN or Infinity', () => {
    expect(formatInr(Number.NaN)).toBe('₹0');
    expect(formatInrCompact(Number.POSITIVE_INFINITY)).toBe('₹0');
  });

  it('never uses a dollar sign', () => {
    for (const v of [1, 1500, 250000, 31000000]) {
      expect(formatInr(v)).not.toContain('$');
      expect(formatInrCompact(v)).not.toContain('$');
    }
  });
});

describe('compact INR (lakh and crore)', () => {
  it('shows the full figure below one lakh', () => {
    expect(formatInrCompact(950)).toBe('₹950');
    expect(formatInrCompact(45200)).toBe('₹45,200');
    expect(formatInrCompact(99999)).toBe('₹99,999');
  });

  it('uses L for lakhs', () => {
    expect(formatInrCompact(100000)).toBe('₹1 L');
    expect(formatInrCompact(120000)).toBe('₹1.2 L');
    expect(formatInrCompact(1245000)).toBe('₹12.5 L');
    expect(formatInrCompact(9_950_000)).toBe('₹99.5 L');
  });

  it('uses Cr for crores', () => {
    expect(formatInrCompact(10_000_000)).toBe('₹1 Cr');
    expect(formatInrCompact(34_000_000)).toBe('₹3.4 Cr');
    expect(formatInrCompact(1_234_500_000)).toBe('₹123 Cr');
  });

  it('promotes a figure that would round to 100 lakh', () => {
    expect(formatInrCompact(9_999_999)).toBe('₹1 Cr');
  });

  it('keeps large crore figures grouped', () => {
    expect(formatInrCompact(123_450_000_000)).toBe('₹12,345 Cr');
  });

  it('puts the minus sign before the rupee', () => {
    expect(formatInrCompact(-120000)).toBe('−₹1.2 L');
  });

  it('compacts plain counts without a currency symbol', () => {
    expect(formatNumberCompact(250000)).toBe('2.5 L');
    expect(formatNumberCompact(850)).toBe('850');
  });
});

describe('deltas and percentages', () => {
  it('signs INR deltas', () => {
    expect(formatInrDelta(1200)).toBe('+₹1,200');
    expect(formatInrDelta(-1200)).toBe('−₹1,200');
    expect(formatInrDelta(0)).toBe('₹0');
    expect(formatInrDelta(250000, true)).toBe('+₹2.5 L');
  });

  it('formats percent in percent units', () => {
    expect(formatPercent(12.5)).toBe('12.5%');
    expect(formatPercent(7.4, 0)).toBe('7%');
  });

  it('signs percent deltas', () => {
    expect(formatSignedPercent(14.2)).toBe('+14.2%');
    expect(formatSignedPercent(-3.14)).toBe('−3.1%');
    expect(formatSignedPercent(0)).toBe('0.0%');
    expect(formatSignedPercent(-0.01)).toBe('0.0%'); // rounds to zero: no sign
  });

  it('formats plain numbers', () => {
    expect(formatNumber(48210)).toBe('48,210');
    expect(formatNumber(1234.5, 1)).toBe('1,234.5');
    expect(formatNumber(12.0, 2)).toBe('12');
  });

  it('classifies a trend', () => {
    expect(trendOf(5)).toBe('up');
    expect(trendOf(-5)).toBe('down');
    expect(trendOf(0.01)).toBe('flat');
  });
});

describe('dates', () => {
  it('keeps a bare date on its calendar day', () => {
    expect(formatDate('2026-03-04')).toBe('4 Mar 2026');
    expect(formatDateShort('2026-03-04')).toBe('4 Mar');
  });

  it('handles missing or invalid values', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not a date')).toBe('—');
    expect(formatDateShort(undefined)).toBe('—');
  });
});
