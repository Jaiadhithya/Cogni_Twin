'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from '@/components/charts/chart-tooltip';
import { ChartCard } from '@/components/ui/chart-card';
import { axisProps, gridProps, seriesPalette } from '@/lib/chart-theme';
import { humanizeMetric, metricFormatters } from '@/lib/dashboard';
import { chartAnimation, usePrefersReducedMotion } from '@/lib/motion';
import type { DataSummary } from '@/lib/api/types';

/** Approximate width of a 12px axis label, used to size the category column. */
const CHAR_PX = 7;
const LABEL_MIN_PX = 72;
const LABEL_MAX_PX = 168;
const LABEL_MAX_CHARS = Math.floor((LABEL_MAX_PX - 12) / CHAR_PX);

/** Width that fits the longest category name, clamped so the bars keep most of the card. */
export function categoryAxisWidth(names: string[]): number {
  const longest = names.reduce((m, n) => Math.max(m, n.length), 0);
  return Math.min(LABEL_MAX_PX, Math.max(LABEL_MIN_PX, longest * CHAR_PX + 12));
}

/** Shortens names that would not fit; the tooltip still shows the full name. */
export function shortenCategory(name: string): string {
  return name.length > LABEL_MAX_CHARS ? `${name.slice(0, LABEL_MAX_CHARS - 1).trimEnd()}…` : name;
}

/** Revenue by category: horizontal bars growing from the baseline. */
export default function CategoryChart({ summary }: { summary: DataSummary }) {
  const reduced = usePrefersReducedMotion();
  const metric = summary.target_metric_name ?? summary.metadata?.target_metric;
  const fmt = metricFormatters(metric);
  const label = humanizeMetric(metric);
  const rows = summary.top_categories;
  const topName = rows[0]?.name;
  const total = rows.reduce((s, r) => s + r.revenue, 0);

  return (
    <ChartCard
      title="Breakdown by category"
      description={`${label} in the top ${rows.length} categories`}
      summary={
        rows.length && topName
          ? `${topName} leads with ${fmt.compact(rows[0].revenue)}, ${Math.round((rows[0].revenue / (total || 1)) * 100)}% of the top ${rows.length} categories.`
          : 'No category breakdown available.'
      }
      height={Math.max(220, rows.length * 48)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} horizontal={false} vertical />
          <XAxis type="number" {...axisProps} tickFormatter={fmt.compact} />
          <YAxis
            type="category"
            dataKey="name"
            {...axisProps}
            width={categoryAxisWidth(rows.map((r) => r.name))}
            tickFormatter={shortenCategory}
            interval={0}
          />
          <Tooltip content={<ChartTooltip formatValue={fmt.full} />} cursor={{ fill: 'var(--color-primary-tint)' }} />
          <Bar dataKey="revenue" name={label} fill={seriesPalette[0]} radius={[0, 8, 8, 0]} barSize={22} {...chartAnimation(reduced)} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
