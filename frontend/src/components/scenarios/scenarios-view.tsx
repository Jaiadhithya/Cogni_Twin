'use client';

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Check, GitCompare } from 'lucide-react';
import { ChartTooltip } from '@/components/charts/chart-tooltip';
import { DatasetGate } from '@/components/layout/dataset-gate';
import { Button, ButtonLink } from '@/components/ui/button';
import { ChangeBadge } from '@/components/ui/change-badge';
import { ChartCard } from '@/components/ui/chart-card';
import { DataState } from '@/components/ui/data-state';
import { EmptyState } from '@/components/ui/empty-state';
import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { RevealGroup, RevealItem } from '@/components/ui/reveal';
import { ChartSkeleton, Skeleton } from '@/components/ui/skeleton';
import { DataTable, type Column } from '@/components/ui/table';
import { axisProps, chartColors, chartMargin, gridProps, seriesPalette } from '@/lib/chart-theme';
import { humanizeLever } from '@/lib/forecast';
import { formatDate, formatInr, formatInrCompact, formatSignedPercent } from '@/lib/formatters';
import { useCompareSimulations, useSimulations } from '@/lib/hooks/queries';
import { chartAnimation, usePrefersReducedMotion } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { SavedSimulation, SimulationComparison } from '@/lib/api/types';

export const MAX_COMPARE = 4;

const METRIC_LABELS: Record<string, string> = {
  baseline_total: 'Baseline total',
  baseline_daily_average: 'Baseline daily average',
  simulated_total: 'Scenario total',
  simulated_daily_average: 'Scenario daily average',
  total_delta: 'Change vs baseline',
  total_delta_pct: 'Change vs baseline (%)',
};

function scenarioName(run: Pick<SavedSimulation, 'name' | 'created_at'>, index: number): string {
  return run.name?.trim() || `Scenario ${index + 1}${run.created_at ? ` · ${formatDate(run.created_at)}` : ''}`;
}

function MutationChips({ mutations }: { mutations: Record<string, unknown> }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {Object.entries(mutations).map(([lever, change]) => (
        <li key={lever} className="rounded-full bg-primary-tint px-2.5 py-0.5 text-xs font-medium text-primary-ink">
          {humanizeLever(lever)} {String(change)}
        </li>
      ))}
    </ul>
  );
}

function ScenarioList({ runs, selected, onToggle }: { runs: SavedSimulation[]; selected: string[]; onToggle: (id: string) => void }) {
  const full = selected.length >= MAX_COMPARE;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {runs.map((run, i) => {
        const isOn = selected.includes(run.id);
        const disabled = !isOn && full;
        const delta = run.delta_metrics.total_delta_pct as number | undefined;
        return (
          <li key={run.id}>
            <button
              type="button"
              role="checkbox"
              aria-checked={isOn}
              aria-disabled={disabled || undefined}
              disabled={disabled}
              onClick={() => onToggle(run.id)}
              className={cn(
                'glass block h-full w-full rounded-card p-5 text-left outline-none transition-[transform,box-shadow,border-color] duration-[160ms] hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0',
                isOn && 'border-primary/60 ring-2 ring-primary/30',
              )}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-ink">{scenarioName(run, i)}</span>
                  <span className="block text-xs text-ink-3">
                    {run.horizon_days} days · saved {formatDate(run.created_at)}
                  </span>
                </span>
                <span aria-hidden className={cn('grid size-6 shrink-0 place-items-center rounded-full border', isOn ? 'border-primary bg-primary text-white' : 'border-border-strong')}>
                  {isOn && <Check className="size-3.5" strokeWidth={3} />}
                </span>
              </span>
              <span className="mt-3 block">
                <MutationChips mutations={run.mutations} />
              </span>
              <span className="mt-4 flex items-center gap-2">
                <span className="text-lg font-semibold tabular-nums text-ink">{formatInrCompact((run.simulated_summary.total as number) ?? 0)}</span>
                {delta !== undefined && <ChangeBadge value={delta} />}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ComparisonChart({ comparison }: { comparison: SimulationComparison }) {
  const reduced = usePrefersReducedMotion();
  const value = (metric: string, i: number) => comparison.metrics.find((m) => m.metric === metric)?.values[i] ?? 0;
  const data = comparison.runs.map((run, i) => ({
    name: scenarioName(run as unknown as SavedSimulation, i),
    Baseline: value('baseline_total', i),
    Scenario: value('simulated_total', i),
  }));
  const best = [...data].sort((a, b) => b.Scenario - a.Scenario)[0];
  return (
    <ChartCard
      title="Scenario totals"
      description="Baseline forecast next to each scenario's forecast total"
      summary={best ? `${best.name} has the highest scenario total at ${formatInrCompact(best.Scenario)}, against a baseline of ${formatInrCompact(best.Baseline)}.` : 'No scenarios selected.'}
      height={300}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={chartMargin}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="name" {...axisProps} />
          <YAxis {...axisProps} tickFormatter={formatInrCompact} width={64} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-primary-tint)' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={0} stroke={chartColors.grid} />
          <Bar dataKey="Baseline" fill={seriesPalette[4]} radius={[8, 8, 0, 0]} {...chartAnimation(reduced)} />
          <Bar dataKey="Scenario" fill={seriesPalette[0]} radius={[8, 8, 0, 0]} {...chartAnimation(reduced, 150)} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function Comparison({ datasetId, ids }: { datasetId: string; ids: string[] }) {
  const query = useCompareSimulations(datasetId, ids);
  return (
    <DataState query={query} errorTitle="We could not compare these scenarios" skeleton={<ChartSkeleton height={300} />}>
      {(data) => {
        type Row = { metric: string; values: Array<number | null> };
        const columns: Column<Row>[] = [
          { key: 'metric', header: 'Measure', cell: (r) => <span className="font-medium text-ink">{METRIC_LABELS[r.metric] ?? humanizeLever(r.metric)}</span> },
          ...data.runs.map((run, i) => ({
            key: `run-${i}`,
            header: scenarioName(run as unknown as SavedSimulation, i),
            numeric: true,
            cell: (r: Row) => {
              const v = r.values[i];
              if (v === null || v === undefined) return '—';
              if (r.metric === 'total_delta_pct') return formatSignedPercent(v);
              return r.metric === 'total_delta' ? `${v >= 0 ? '+' : '−'}${formatInr(Math.abs(v))}` : formatInr(v);
            },
          })),
        ];
        return (
          <RevealGroup className="space-y-5">
            <RevealItem>
              <ComparisonChart comparison={data} />
            </RevealItem>
            <RevealItem>
              <GlassCard as="section" aria-label="Comparison table">
                <h2 className="t-h2 mb-4">Side by side</h2>
                <DataTable columns={columns} rows={data.metrics} rowKey={(r) => r.metric} caption="Scenarios side by side" />
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {data.runs.map((run, i) => (
                    <li key={String(run.id)}>
                      <p className="mb-1 text-xs font-semibold text-ink-3">{scenarioName(run as unknown as SavedSimulation, i)}</p>
                      <MutationChips mutations={run.mutations as Record<string, unknown>} />
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </RevealItem>
          </RevealGroup>
        );
      }}
    </DataState>
  );
}

function Content({ datasetId }: { datasetId: string }) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const list = useSimulations(datasetId, page);

  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < MAX_COMPARE ? [...cur, id] : cur));

  return (
    <div className="space-y-6">
      <DataState
        query={list}
        errorTitle="We could not load your scenarios"
        isEmpty={(d) => d.records.length === 0}
        skeleton={
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 rounded-card" />
            ))}
          </div>
        }
        empty={
          <EmptyState
            icon={<GitCompare strokeWidth={1.75} />}
            title="No scenarios saved yet"
            description="Run a what-if on the Forecast page and press “Save scenario”. Saved scenarios show up here so you can compare them."
            action={
              <ButtonLink href="/forecast" variant="cta" size="sm" arrow>
                Open Forecast & What-If
              </ButtonLink>
            }
          />
        }
      >
        {(data) => (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-2" aria-live="polite">
                {selected.length === 0 ? `Select 2 to ${MAX_COMPARE} scenarios to compare.` : selected.length === 1 ? 'Select one more to compare.' : `Comparing ${selected.length} scenarios.`}
              </p>
              {selected.length > 0 && (
                <Button variant="ghost" onClick={() => setSelected([])}>
                  Clear selection
                </Button>
              )}
            </div>
            <ScenarioList runs={data.records} selected={selected} onToggle={toggle} />
            {data.pagination && data.pagination.total_pages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span className="text-sm text-ink-3">
                  Page {data.pagination.page} of {data.pagination.total_pages}
                </span>
                <Button size="sm" disabled={page >= data.pagination.total_pages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </DataState>

      {selected.length >= 2 && <Comparison datasetId={datasetId} ids={selected} />}
    </div>
  );
}

export function ScenariosView() {
  const header = <PageHeader title="Scenarios" description="Compare saved what-if scenarios side by side." />;
  return (
    <div className="space-y-6">
      {header}
      <DatasetGate>{(datasetId) => <Content key={datasetId} datasetId={datasetId} />}</DatasetGate>
    </div>
  );
}
