'use client';

import { useMemo, useState } from 'react';
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from '@/components/charts/chart-tooltip';
import { DatasetGate } from '@/components/layout/dataset-gate';
import { ChartCard } from '@/components/ui/chart-card';
import { DataState } from '@/components/ui/data-state';
import { EmptyState } from '@/components/ui/empty-state';
import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ChartSkeleton, TableSkeleton } from '@/components/ui/skeleton';
import { DataTable, type Column } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { axisProps, chartColors, chartMargin, gridProps, seriesPalette } from '@/lib/chart-theme';
import { describeCorrelation } from '@/lib/explorer';
import { formatNumber, formatNumberCompact } from '@/lib/formatters';
import { useCorrelations, useProfile, useScatter } from '@/lib/hooks/queries';
import { chartAnimation, usePrefersReducedMotion } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { CategoricalColumnProfile, CorrelationMethod, DatasetCorrelations, NumericColumnProfile } from '@/lib/api/types';

const n = (v: number | null, digits = 2) => (v === null ? '—' : formatNumber(v, digits));

/* ─── Columns ─── */

function ColumnsTab({ datasetId }: { datasetId: string }) {
  const query = useProfile(datasetId);
  const numeric: Column<NumericColumnProfile>[] = [
    { key: 'column', header: 'Column', cell: (r) => <span className="font-medium text-ink">{r.column}</span>, sortValue: (r) => r.column },
    { key: 'count', header: 'Count', cell: (r) => formatNumber(r.count), sortValue: (r) => r.count, numeric: true },
    { key: 'nulls', header: 'Missing', cell: (r) => (r.nulls ? <span className="text-warning">{formatNumber(r.nulls)}</span> : '0'), sortValue: (r) => r.nulls, numeric: true },
    { key: 'mean', header: 'Mean', cell: (r) => n(r.mean), sortValue: (r) => r.mean, numeric: true },
    { key: 'median', header: 'Median', cell: (r) => n(r.median), sortValue: (r) => r.median, numeric: true },
    { key: 'std', header: 'Std dev', cell: (r) => n(r.std), sortValue: (r) => r.std, numeric: true },
    { key: 'min', header: 'Min', cell: (r) => n(r.min), sortValue: (r) => r.min, numeric: true },
    { key: 'max', header: 'Max', cell: (r) => n(r.max), sortValue: (r) => r.max, numeric: true },
    { key: 'iqr', header: 'IQR', cell: (r) => n(r.iqr), sortValue: (r) => r.iqr, numeric: true },
    { key: 'skew', header: 'Skew', cell: (r) => n(r.skewness), sortValue: (r) => r.skewness, numeric: true },
  ];
  const categorical: Column<CategoricalColumnProfile>[] = [
    { key: 'column', header: 'Column', cell: (r) => <span className="font-medium text-ink">{r.column}</span>, sortValue: (r) => r.column },
    { key: 'distinct', header: 'Distinct', cell: (r) => formatNumber(r.cardinality), sortValue: (r) => r.cardinality, numeric: true },
    { key: 'nulls', header: 'Missing', cell: (r) => formatNumber(r.nulls), sortValue: (r) => r.nulls, numeric: true },
    { key: 'top', header: 'Most common', cell: (r) => r.top_values.map((v) => `${v.value} (${formatNumber(v.count)})`).join(', ') },
  ];
  return (
    <DataState query={query} errorTitle="We could not profile this dataset" skeleton={<TableSkeleton rows={6} columns={6} />}>
      {(data) => (
        <div className="space-y-6">
          <p className="text-sm text-ink-3">{formatNumber(data.row_count)} rows</p>
          <section aria-label="Numeric columns" className="space-y-2">
            <h2 className="t-h2">Numeric columns</h2>
            {data.numeric.length ? <DataTable columns={numeric} rows={data.numeric} rowKey={(r) => r.column} caption="Numeric column statistics" /> : <EmptyState bare title="No numeric columns" />}
          </section>
          <section aria-label="Text columns" className="space-y-2">
            <h2 className="t-h2">Text columns</h2>
            {data.categorical.length ? <DataTable columns={categorical} rows={data.categorical} rowKey={(r) => r.column} caption="Text column statistics" /> : <EmptyState bare title="No text columns" />}
          </section>
          {data.skipped_columns.length > 0 && <p className="text-sm text-warning">Skipped {data.skipped_columns.length} columns to keep this fast: {data.skipped_columns.join(', ')}.</p>}
          {data.notes.map((note) => (
            <p key={note} className="text-xs text-ink-3">
              {note}
            </p>
          ))}
        </div>
      )}
    </DataState>
  );
}

/* ─── Correlations ─── */

/** Blue for positive, amber for negative; the stronger the correlation the deeper the tint. */
function cellColor(value: number | null): string {
  if (value === null) return 'transparent';
  const strength = Math.round(Math.min(1, Math.abs(value)) * 85);
  return `color-mix(in srgb, ${value >= 0 ? 'var(--color-chart-1)' : 'var(--color-chart-4)'} ${strength}%, white)`;
}

function Heatmap({ data }: { data: DatasetCorrelations }) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const { columns, matrix, n: counts } = data;
  const active = hover ?? null;
  const describe = (r: number, c: number) => {
    const v = matrix[r][c];
    return `${columns[r]} vs ${columns[c]}: ${v === null ? 'could not be computed (a column is constant)' : `${v.toFixed(2)}, ${describeCorrelation(v)}`}, from ${formatNumber(counts[r][c])} rows`;
  };
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto" role="region" aria-label="Correlation heatmap" tabIndex={0}>
        <div className="inline-grid min-w-full gap-1 text-xs" style={{ gridTemplateColumns: `minmax(96px, auto) repeat(${columns.length}, minmax(52px, 1fr))` }}>
          <span />
          {columns.map((c) => (
            <span key={c} className="truncate px-1 pb-1 text-center font-medium text-ink-3" title={c}>
              {c}
            </span>
          ))}
          {columns.map((row, r) => (
            <div key={row} className="contents">
              <span className="truncate pr-2 text-right font-medium leading-[44px] text-ink-3" title={row}>
                {row}
              </span>
              {columns.map((col, c) => {
                const v = matrix[r][c];
                return (
                  <button
                    key={col}
                    type="button"
                    aria-label={describe(r, c)}
                    onMouseEnter={() => setHover({ r, c })}
                    onFocus={() => setHover({ r, c })}
                    onMouseLeave={() => setHover(null)}
                    onBlur={() => setHover(null)}
                    className={cn('h-11 rounded-md text-[11px] font-semibold tabular-nums outline-none transition-transform duration-[120ms] hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary', v !== null && Math.abs(v) > 0.55 ? 'text-white' : 'text-ink')}
                    style={{ background: cellColor(v), border: v === null ? '1px dashed var(--color-border-strong)' : undefined }}
                  >
                    {v === null ? '—' : v.toFixed(2)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p role="status" className="min-h-5 text-sm text-ink-2">
        {active ? describe(active.r, active.c) : 'Hover or focus a cell to see the pair and how many rows it is based on.'}
      </p>
      <div className="flex flex-wrap items-center gap-4 text-xs text-ink-3">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm" style={{ background: cellColor(0.8) }} /> Positive: move together
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm" style={{ background: cellColor(-0.8) }} /> Negative: move opposite
        </span>
        {data.sampled && <span className="text-warning">Based on a random sample of {formatNumber(data.sample_size)} rows.</span>}
      </div>
    </div>
  );
}

function CorrelationsTab({ datasetId }: { datasetId: string }) {
  const [method, setMethod] = useState<CorrelationMethod>('pearson');
  const query = useCorrelations(datasetId, method);
  return (
    <GlassCard className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="t-h2">Correlations</h2>
          <p className="mt-0.5 text-sm text-ink-3">How strongly each pair of numeric columns moves together.</p>
        </div>
        <SegmentedControl
          label="Correlation method"
          value={method}
          onValueChange={setMethod}
          options={[
            { value: 'pearson', label: 'Pearson' },
            { value: 'spearman', label: 'Spearman' },
          ]}
        />
      </div>
      <DataState query={query} errorTitle="We could not compute correlations" skeleton={<ChartSkeleton height={320} />}>
        {(data) => <Heatmap data={data} />}
      </DataState>
      <p className="text-xs text-ink-3">{method === 'pearson' ? 'Pearson measures straight-line relationships.' : 'Spearman compares rankings, so it also catches curved but steady relationships.'} Correlation is not causation.</p>
    </GlassCard>
  );
}

/* ─── Scatter ─── */

function ScatterTab({ datasetId }: { datasetId: string }) {
  const profile = useProfile(datasetId);
  const reduced = usePrefersReducedMotion();
  const columns = useMemo(() => profile.data?.numeric.map((c) => c.column) ?? [], [profile.data]);
  const [xPick, setX] = useState<string | undefined>();
  const [yPick, setY] = useState<string | undefined>();
  const x = xPick ?? columns[0];
  const y = yPick ?? columns[1] ?? columns[0];
  const scatter = useScatter(datasetId, x, y);
  const options = columns.map((c) => ({ value: c, label: c }));

  return (
    <GlassCard className="space-y-4">
      <div>
        <h2 className="t-h2">Scatter plot</h2>
        <p className="mt-0.5 text-sm text-ink-3">Plot any two numeric columns against each other.</p>
      </div>
      <DataState
        query={profile}
        skeleton={<ChartSkeleton height={320} />}
        isEmpty={(d) => d.numeric.length < 2}
        empty={<EmptyState bare title="Not enough numeric columns" description="A scatter plot needs at least two numeric columns." />}
      >
        {() => (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="X axis" value={x} onValueChange={setX} options={options} />
              <Select label="Y axis" value={y} onValueChange={setY} options={options} />
            </div>
            <DataState query={scatter} errorTitle="We could not build this plot" skeleton={<ChartSkeleton height={320} />}>
              {(data) => (
                <ChartCard
                  title={`${data.y} vs ${data.x}`}
                  description={`${formatNumber(data.returned)} of ${formatNumber(data.total_pairs)} points${data.sampled ? ' (random sample)' : ''}`}
                  summary={`Scatter of ${data.y} against ${data.x} with ${data.returned} points. ${data.pearson_r === null ? 'The correlation could not be computed.' : `Pearson r is ${data.pearson_r.toFixed(2)}, a ${describeCorrelation(data.pearson_r)} relationship.`}`}
                  height={340}
                  footer={data.pearson_r === null ? 'Correlation could not be computed (one column is constant).' : <>Pearson r = <strong className="tabular-nums text-ink">{data.pearson_r.toFixed(3)}</strong> over all {formatNumber(data.total_pairs)} pairs: {describeCorrelation(data.pearson_r)}.</>}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={chartMargin}>
                      <CartesianGrid {...gridProps} vertical />
                      <XAxis dataKey={data.x} type="number" name={data.x} {...axisProps} tickFormatter={formatNumberCompact} domain={['auto', 'auto']} />
                      <YAxis dataKey={data.y} type="number" name={data.y} {...axisProps} tickFormatter={formatNumberCompact} width={60} domain={['auto', 'auto']} />
                      <Tooltip content={<ChartTooltip formatValue={(v) => formatNumber(v, 2)} />} cursor={{ strokeDasharray: '3 4', stroke: chartColors.cursor }} />
                      <Scatter data={data.points} fill={seriesPalette[0]} fillOpacity={0.55} {...chartAnimation(reduced)} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </DataState>
          </div>
        )}
      </DataState>
    </GlassCard>
  );
}

function Content({ datasetId }: { datasetId: string }) {
  return (
    <Tabs defaultValue="columns">
      <TabsList aria-label="Explorer sections">
        <TabsTrigger value="columns">Columns</TabsTrigger>
        <TabsTrigger value="correlations">Correlations</TabsTrigger>
        <TabsTrigger value="scatter">Scatter</TabsTrigger>
      </TabsList>
      <TabsContent value="columns">
        <ColumnsTab datasetId={datasetId} />
      </TabsContent>
      <TabsContent value="correlations">
        <CorrelationsTab datasetId={datasetId} />
      </TabsContent>
      <TabsContent value="scatter">
        <ScatterTab datasetId={datasetId} />
      </TabsContent>
    </Tabs>
  );
}

export function ExplorerView() {
  return (
    <div className="space-y-6">
      <PageHeader title="Data Explorer" description="Profile your columns, see which ones move together and plot any two against each other." />
      <DatasetGate>{(datasetId) => <Content key={datasetId} datasetId={datasetId} />}</DatasetGate>
    </div>
  );
}
