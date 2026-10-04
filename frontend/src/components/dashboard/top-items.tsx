'use client';

import { DataTable, type Column } from '@/components/ui/table';
import { GlassCard } from '@/components/ui/glass-card';
import { humanizeMetric, metricFormatters } from '@/lib/dashboard';
import { formatPercent } from '@/lib/formatters';
import type { DataSummary, NameRevenue } from '@/lib/api/types';

export function TopItems({ summary }: { summary: DataSummary }) {
  const metric = summary.target_metric_name ?? summary.metadata?.target_metric;
  const fmt = metricFormatters(metric);
  const total = summary.total_revenue || summary.kpis.total_target || 0;

  const columns: Column<NameRevenue>[] = [
    { key: 'name', header: 'Item', cell: (r) => <span className="font-medium text-ink">{r.name}</span>, sortValue: (r) => r.name },
    { key: 'revenue', header: humanizeMetric(metric), cell: (r) => fmt.full(r.revenue), sortValue: (r) => r.revenue, numeric: true },
    { key: 'share', header: 'Share', cell: (r) => (total ? formatPercent((r.revenue / total) * 100) : '—'), sortValue: (r) => r.revenue, numeric: true },
  ];

  return (
    <GlassCard as="section" aria-label="Top items">
      <h2 className="t-h2">Top items</h2>
      <p className="mb-4 mt-0.5 text-sm text-ink-3">The biggest contributors to {humanizeMetric(metric).toLowerCase()}</p>
      <DataTable columns={columns} rows={summary.top_products} rowKey={(r) => r.name} caption="Top items by contribution" defaultSort={{ key: 'revenue', direction: 'desc' }} />
    </GlassCard>
  );
}
