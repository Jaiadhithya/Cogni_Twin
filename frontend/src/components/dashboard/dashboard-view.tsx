'use client';

import dynamic from 'next/dynamic';
import { Banknote, Receipt, ShoppingBag, TrendingUp } from 'lucide-react';
import { DatasetGate } from '@/components/layout/dataset-gate';
import { ButtonLink } from '@/components/ui/button';
import { ChartSkeleton, KpiSkeleton, TableSkeleton } from '@/components/ui/skeleton';
import { DataState } from '@/components/ui/data-state';
import { EmptyState } from '@/components/ui/empty-state';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { RevealGroup, RevealItem } from '@/components/ui/reveal';
import { GlassCard } from '@/components/ui/glass-card';
import { humanizeMetric, metricFormatters, periodChange, summaryIsEmpty } from '@/lib/dashboard';
import { formatNumber, formatSignedPercent } from '@/lib/formatters';
import { useSummary } from '@/lib/hooks/queries';
import { useActiveDataset } from '@/lib/dataset-context';
import type { DataSummary } from '@/lib/api/types';
import { InsightPanel } from './insight-panel';
import { ModelHealth } from './model-health';
import { TopItems } from './top-items';
import { TrendChart } from './trend-chart';

// Below the fold: loaded on demand so the first paint is lighter.
const CategoryChart = dynamic(() => import('./category-chart'), { ssr: false, loading: () => <ChartSkeleton height={240} /> });

function Kpis({ summary }: { summary: DataSummary }) {
  const metric = summary.target_metric_name ?? summary.metadata?.target_metric;
  const fmt = metricFormatters(metric);
  const change = periodChange(summary.timeline, 30);
  const label = humanizeMetric(metric);

  return (
    <RevealGroup className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <RevealItem>
        <KpiCard
          label={`Total ${label.toLowerCase()}`}
          value={summary.kpis.total_target}
          format={fmt.compact}
          icon={fmt.money ? <Banknote /> : <ShoppingBag />}
          change={change?.pct ?? undefined}
          hint={change?.pct != null ? 'last 30 days vs the 30 before' : 'needs 60 days of history for a comparison'}
        />
      </RevealItem>
      <RevealItem>
        <KpiCard label="Orders" value={summary.total_orders} format={(v) => formatNumber(Math.round(v))} icon={<ShoppingBag />} hint="rows in this dataset" />
      </RevealItem>
      <RevealItem>
        <KpiCard label={`Average per order`} value={summary.kpis.avg_target} format={(v) => (fmt.money ? fmt.full(v) : formatNumber(v, 1))} icon={<Receipt />} hint={label} />
      </RevealItem>
      <RevealItem>
        <KpiCard
          label="Growth"
          value={change?.pct ?? 0}
          format={(v) => (change?.pct == null ? '—' : formatSignedPercent(v))}
          icon={<TrendingUp />}
          change={change?.pct ?? undefined}
          hint="30-day change"
        />
      </RevealItem>
    </RevealGroup>
  );
}

function Content({ datasetId }: { datasetId: string }) {
  const summary = useSummary(datasetId);
  return (
    <div className="space-y-5">
      <DataState
        query={summary}
        errorTitle="We could not load your dashboard"
        isEmpty={summaryIsEmpty}
        empty={
          <EmptyState
            title="This dataset has no rows yet"
            description="Upload a CSV with at least a date column and a sales column."
            action={
              <ButtonLink href="/upload" variant="cta" size="sm">
                Upload data
              </ButtonLink>
            }
          />
        }
        skeleton={
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <KpiSkeleton key={i} />
              ))}
            </div>
            <ChartSkeleton height={300} />
            <div className="grid gap-5 lg:grid-cols-2">
              <ChartSkeleton height={240} />
              <GlassCard>
                <TableSkeleton />
              </GlassCard>
            </div>
          </div>
        }
      >
        {(data) => (
          <RevealGroup className="space-y-5">
            <Kpis summary={data} />
            <RevealItem>
              <TrendChart summary={data} />
            </RevealItem>
            <RevealItem className="grid gap-5 lg:grid-cols-2">
              <CategoryChart summary={data} />
              <TopItems summary={data} />
            </RevealItem>
          </RevealGroup>
        )}
      </DataState>

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <InsightPanel datasetId={datasetId} />
        <ModelHealth datasetId={datasetId} />
      </div>
    </div>
  );
}

export function DashboardView() {
  const { dataset } = useActiveDataset();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={dataset ? `What is happening in ${dataset.filename}.` : 'What is happening in your business.'}
        actions={
          <ButtonLink href="/forecast" variant="secondary" size="sm" arrow>
            See the forecast
          </ButtonLink>
        }
      />
      <DatasetGate>{(datasetId) => <Content datasetId={datasetId} />}</DatasetGate>
    </div>
  );
}
