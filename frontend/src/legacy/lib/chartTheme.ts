/**
 * Chart theme — single source of truth for every charting surface.
 * Kills the tooltip-style duplication across RevenueChart, CategoricalChart,
 * ForecastChart and DynamicChartRenderer.
 *
 * Rules:
 *  - Amber is the primary series ("the trace").
 *  - Emerald/coral are data semantics only (positive/negative, actual vs forecast).
 *  - No neon glow on chart geometry; weight comes from line weight + area fill.
 */

export const CHART_COLORS = {
  trace: '#FFB020',        // primary series — the signal
  traceDim: '#C98A0C',
  actual: '#F5F3EF',      // historical actual (ink)
  forecast: '#FFB020',    // predicted
  band: 'rgba(255, 176, 32, 0.12)',  // confidence corridor
  bandStrong: 'rgba(255, 176, 32, 0.22)',
  positive: '#34D399',
  negative: '#F87171',
  grid: 'rgba(245, 243, 239, 0.055)',
  gridStrong: 'rgba(245, 243, 239, 0.10)',
  axis: '#8A837A',        // ink-muted, ~5:1 on graphite
  crosshair: 'rgba(255, 176, 32, 0.45)',
  surface: '#161614',
  surfaceBorder: 'rgba(245, 243, 239, 0.14)',
} as const;

/** Categorical palette for multi-series charts — restrained, analogous. */
export const SERIES_PALETTE = [
  '#FFB020',
  '#B8B2A8',
  '#34D399',
  '#8A837A',
  '#F87171',
  '#C98A0C',
  '#5F5A52',
  '#E8C26A',
] as const;

/** Shared Visx tooltip card styling. */
export const tooltipStyles = {
  backgroundColor: 'rgba(22, 22, 20, 0.96)',
  border: '1px solid rgba(245, 243, 239, 0.14)',
  borderRadius: '8px',
  boxShadow: '0 18px 40px -16px rgba(8, 8, 7, 0.8), 0 2px 6px rgba(8, 8, 7, 0.4)',
  color: '#F5F3EF',
  padding: '10px 12px',
  fontFamily: 'var(--font-plus-jakarta), sans-serif',
  fontSize: '12px',
  zIndex: 70,
} as const;

/** Mono readout for numeric tooltip values. */
export const tooltipValueStyles: React.CSSProperties = {
  fontFamily: 'var(--font-jetbrains-mono), monospace',
  fontVariantNumeric: 'tabular-nums',
  fontSize: '14px',
  fontWeight: 600,
  color: CHART_COLORS.trace,
};

/** Visx axis tick label props — mono, muted, legible. */
export const axisTickProps = {
  fill: CHART_COLORS.axis,
  fontSize: 10,
  fontFamily: 'var(--font-jetbrains-mono), monospace',
} as const;
