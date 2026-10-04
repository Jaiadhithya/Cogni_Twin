/**
 * Display helpers for the dashboard. These only slice and compare the series the backend
 * returned (`/data/summary`); they never produce numbers the backend did not send.
 */
import type { DataSummary } from '@/lib/api/types';
import { formatInr, formatInrCompact, formatNumber, formatNumberCompact } from '@/lib/formatters';
import type { Period } from '@/components/ui/segmented-control';

export interface TimelinePoint {
  date: string;
  value: number;
}

/** The last `days` points of a daily timeline, or all of it for "all". */
export function sliceTimeline(timeline: ReadonlyArray<TimelinePoint>, period: Period): TimelinePoint[] {
  if (period === 'all') return [...timeline];
  const days = Number(period);
  return timeline.slice(-days);
}

export interface PeriodChange {
  current: number;
  previous: number;
  /** Percent change; null when the previous period is zero or there is not enough history. */
  pct: number | null;
}

/** Sum of the last `days` vs the `days` before them. Null when history is shorter than 2×days. */
export function periodChange(timeline: ReadonlyArray<TimelinePoint>, days: number): PeriodChange | null {
  if (timeline.length < days * 2) return null;
  const sum = (points: ReadonlyArray<TimelinePoint>) => points.reduce((total, p) => total + p.value, 0);
  const current = sum(timeline.slice(-days));
  const previous = sum(timeline.slice(-days * 2, -days));
  return { current, previous, pct: previous > 0 ? ((current - previous) / previous) * 100 : null };
}

/** Whether the dataset's target column is money (shown in ₹) or a plain count. */
export function isMoneyMetric(name: string | undefined): boolean {
  return /revenue|sales|amount|profit|income|price|value|gmv/i.test(name ?? 'revenue');
}

export function metricFormatters(name: string | undefined) {
  const money = isMoneyMetric(name);
  return {
    money,
    full: (value: number): string => (money ? formatInr(value) : formatNumber(value)),
    compact: money ? formatInrCompact : formatNumberCompact,
  };
}

export function humanizeMetric(name: string | undefined): string {
  const text = (name ?? 'revenue').replace(/_/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function summaryIsEmpty(summary: DataSummary): boolean {
  return summary.kpis.total_rows === 0 && summary.timeline.length === 0;
}
