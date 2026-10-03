/**
 * Shared Recharts theme: palette, axes, grid and tooltip. Every chart in the app uses this
 * module so they read as one system. Colours are the design tokens from globals.css.
 *
 * Meaning: actuals = blue, forecast = purple, confidence band = purple at 12% opacity.
 */
import type { CSSProperties } from 'react';

export const chartColors = {
  actual: 'var(--color-chart-1)',
  forecast: 'var(--color-chart-2)',
  band: 'var(--color-chart-2)',
  bandOpacity: 0.12,
  bandOpacityOuter: 0.07,
  positive: 'var(--color-positive)',
  negative: 'var(--color-negative)',
  grid: 'var(--color-border)',
  axis: 'var(--color-ink-3)',
  cursor: 'var(--color-border-strong)',
} as const;

/** Categorical series colours, in order. */
export const seriesPalette = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
] as const;

export const seriesColor = (index: number): string => seriesPalette[index % seriesPalette.length];

export const axisProps = {
  tick: { fill: chartColors.axis, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: chartColors.grid },
  tickMargin: 8,
} as const;

export const gridProps = {
  stroke: chartColors.grid,
  strokeDasharray: '3 4',
  vertical: false,
} as const;

export const chartMargin = { top: 8, right: 8, bottom: 0, left: 0 } as const;

/** Solid white tooltip card with tabular numbers. */
export const tooltipStyle: CSSProperties = {
  background: 'var(--color-surface-solid)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  boxShadow: 'var(--shadow-menu)',
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--color-ink)',
  fontVariantNumeric: 'tabular-nums',
};

export const lineStyle = { strokeWidth: 2.25, dot: false, activeDot: { r: 4, strokeWidth: 0 } } as const;
