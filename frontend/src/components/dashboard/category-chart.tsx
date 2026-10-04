'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from '@/components/charts/chart-tooltip';
import { ChartCard } from '@/components/ui/chart-card';
import { axisProps, gridProps, seriesPalette } from '@/lib/chart-theme';
import { humanizeMetric, metricFormatters } from '@/lib/dashboard';
import { chartAnimation, usePrefersReducedMotion } from '@/lib/motion';
import type { DataSummary } from '@/lib/api/types';

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
          <YAxis type="category" dataKey="name" {...axisProps} width={104} />
          <Tooltip content={<ChartTooltip formatValue={fmt.full} />} cursor={{ fill: 'var(--color-primary-tint)' }} />
          <Bar dataKey="revenue" name={label} fill={seriesPalette[0]} radius={[0, 8, 8, 0]} barSize={22} {...chartAnimation(reduced)} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
