'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from '@/components/charts/chart-tooltip';
import { ChartCard } from '@/components/ui/chart-card';
import { PeriodPicker, type Period } from '@/components/ui/segmented-control';
import { axisProps, chartColors, chartMargin, gridProps, lineStyle } from '@/lib/chart-theme';
import { humanizeMetric, metricFormatters, periodChange, sliceTimeline } from '@/lib/dashboard';
import { formatDateShort, formatSignedPercent } from '@/lib/formatters';
import { chartAnimation, usePrefersReducedMotion } from '@/lib/motion';
import type { DataSummary } from '@/lib/api/types';

/** Main trend chart with a period picker. */
export function TrendChart({ summary }: { summary: DataSummary }) {
  const [period, setPeriod] = useState<Period>('30');
  const reduced = usePrefersReducedMotion();
  const metric = summary.target_metric_name ?? summary.metadata?.target_metric;
  const fmt = metricFormatters(metric);
  const label = humanizeMetric(metric);

  const data = useMemo(() => sliceTimeline(summary.timeline, period), [summary.timeline, period]);
  const change = useMemo(() => (period === 'all' ? null : periodChange(summary.timeline, Number(period))), [summary.timeline, period]);

  const peak = data.reduce((best, p) => (p.value > best.value ? p : best), data[0] ?? { date: '', value: 0 });
  const total = data.reduce((sum, p) => sum + p.value, 0);
  const summaryText = data.length
    ? `Daily ${label.toLowerCase()} over ${data.length} days totals ${fmt.compact(total)}, peaking at ${fmt.compact(peak.value)} on ${formatDateShort(peak.date)}.` +
      (change?.pct != null ? ` That is ${formatSignedPercent(change.pct)} versus the previous ${period} days.` : '')
    : `No ${label.toLowerCase()} data in this period.`;

  return (
    <ChartCard
      title={`${label} over time`}
      description={`Daily, last ${period === 'all' ? 'all available days' : `${period} days`}`}
      summary={summaryText}
      actions={<PeriodPicker value={period} onChange={setPeriod} />}
      height={300}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={chartMargin}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="date" {...axisProps} tickFormatter={formatDateShort} minTickGap={36} />
          <YAxis {...axisProps} tickFormatter={fmt.compact} width={64} />
          <Tooltip content={<ChartTooltip formatValue={fmt.full} formatLabel={(l) => formatDateShort(String(l))} />} cursor={{ stroke: chartColors.cursor }} />
          <Area
            type="monotone"
            dataKey="value"
            name={label}
            stroke={chartColors.actual}
            fill={chartColors.actual}
            fillOpacity={0.08}
            {...lineStyle}
            {...chartAnimation(reduced)}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
