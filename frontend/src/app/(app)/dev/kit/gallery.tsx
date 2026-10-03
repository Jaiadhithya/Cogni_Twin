'use client';

import { useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from 'recharts';
import { Banknote, Boxes, Receipt, TrendingUp } from 'lucide-react';
import { ChartTooltip } from '@/components/charts/chart-tooltip';
import { HealthPillView } from '@/components/layout/health-pill';
import { summarizeHealth } from '@/components/layout/health';
import { Button, ButtonLink } from '@/components/ui/button';
import { ChangeBadge } from '@/components/ui/change-badge';
import { ChartCard } from '@/components/ui/chart-card';
import { CountUp } from '@/components/ui/count-up';
import { DataState } from '@/components/ui/data-state';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { DropZone } from '@/components/ui/drop-zone';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { GlassCard } from '@/components/ui/glass-card';
import { InsightCard } from '@/components/ui/insight-card';
import { Input } from '@/components/ui/input';
import { JobStatus } from '@/components/ui/job-status';
import { KpiCard } from '@/components/ui/kpi-card';
import { MethodLabel } from '@/components/ui/method-label';
import { PageHeader } from '@/components/ui/page-header';
import { RevealGroup, RevealItem } from '@/components/ui/reveal';
import { Select } from '@/components/ui/select';
import { SegmentedControl, PeriodPicker, type Period } from '@/components/ui/segmented-control';
import { ChartSkeleton, KpiSkeleton, Skeleton, SkeletonText, TableSkeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { SourceChip } from '@/components/ui/source-chip';
import { Switch } from '@/components/ui/switch';
import { DataTable, type Column } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api/errors';
import { axisProps, chartColors, chartMargin, gridProps, lineStyle, seriesPalette } from '@/lib/chart-theme';
import { formatDateShort, formatInr, formatInrCompact, formatSignedPercent } from '@/lib/formatters';
import type { Health } from '@/lib/api/types';
import { chartAnimation, usePrefersReducedMotion } from '@/lib/motion';
import { useActiveDataset } from '@/lib/dataset-context';
import { useSummary } from '@/lib/hooks/queries';
import { useTrainingJob } from '@/lib/hooks/training';
import { useSettings } from '@/lib/settings';
import type { TrainingPhase } from '@/lib/hooks/training';

/* ─── Sample data (gallery only) ─── */

const BASE = new Date('2026-03-01T12:00:00Z');
const day = (i: number) => new Date(BASE.getTime() + i * 86400000).toISOString().slice(0, 10);

const forecastData = Array.from({ length: 60 }, (_, i) => {
  const actual = i < 36 ? Math.round(180000 + Math.sin(i / 3) * 22000 + i * 900) : null;
  const predicted = i >= 35 ? Math.round(213000 + Math.sin(i / 3) * 20000 + (i - 35) * 700) : null;
  const half = predicted ? 9000 + (i - 35) * 900 : 0;
  return {
    date: day(i),
    actual,
    forecast: predicted,
    band: predicted ? [predicted - half, predicted + half] : null,
  };
});

const barData = [
  { name: 'Staples', revenue: 4_820_000 },
  { name: 'Dairy', revenue: 3_410_000 },
  { name: 'Beverages', revenue: 2_760_000 },
  { name: 'Snacks', revenue: 1_980_000 },
];

interface ProductRow {
  name: string;
  units: number;
  revenue: number;
}
const products: ProductRow[] = [
  { name: 'Aashirvaad Atta 10kg', units: 4210, revenue: 2_105_000 },
  { name: 'Basmati Rice 5kg', units: 3120, revenue: 1_872_000 },
  { name: 'Sunflower Oil 1L', units: 5890, revenue: 1_120_000 },
  { name: 'Toor Dal 1kg', units: 2740, revenue: 411_000 },
];
const productColumns: Column<ProductRow>[] = [
  { key: 'name', header: 'Product', cell: (r) => <span className="font-medium text-ink">{r.name}</span>, sortValue: (r) => r.name },
  { key: 'units', header: 'Units', cell: (r) => r.units.toLocaleString('en-IN'), sortValue: (r) => r.units, numeric: true },
  { key: 'revenue', header: 'Revenue', cell: (r) => formatInr(r.revenue), sortValue: (r) => r.revenue, numeric: true },
];

const healthy: Health = { status: 'ok', components: { database: 'healthy', model_directory: 'accessible', qdrant: 'reachable', llm_api_key: 'configured' } };
const degraded: Health = { status: 'degraded', components: { ...healthy.components, qdrant: 'unreachable: ConnectError' } };
const dbDown: Health = { status: 'degraded', components: { ...healthy.components, database: 'unhealthy: OperationalError' } };

/* ─── Layout helpers ─── */

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 space-y-4">
      <div>
        <h2 id={`${id}-h`} className="t-h2">
          {title}
        </h2>
        {note && <p className="mt-0.5 text-sm text-ink-3">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="t-label">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/* ─── Charts ─── */

function ForecastExample({ replay }: { replay: number }) {
  const reduced = usePrefersReducedMotion();
  return (
    <ResponsiveContainer width="100%" height="100%" key={replay}>
      <ComposedChart data={forecastData} margin={chartMargin}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="date" {...axisProps} tickFormatter={formatDateShort} minTickGap={32} />
        <YAxis {...axisProps} tickFormatter={formatInrCompact} width={64} />
        <Tooltip content={<ChartTooltip formatLabel={(l) => formatDateShort(String(l))} hide={['band']} />} cursor={{ stroke: chartColors.cursor }} />
        <Area type="monotone" dataKey="band" name="80% range" stroke="none" fill={chartColors.band} fillOpacity={chartColors.bandOpacity} {...chartAnimation(reduced, 700)} />
        <Line type="monotone" dataKey="actual" name="Actual" stroke={chartColors.actual} {...lineStyle} {...chartAnimation(reduced)} />
        <Line type="monotone" dataKey="forecast" name="Forecast" stroke={chartColors.forecast} strokeDasharray="5 4" {...lineStyle} {...chartAnimation(reduced, 350)} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function BarExample({ replay }: { replay: number }) {
  const reduced = usePrefersReducedMotion();
  return (
    <ResponsiveContainer width="100%" height="100%" key={replay}>
      <BarChart data={barData} margin={chartMargin}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="name" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={formatInrCompact} width={64} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-primary-tint)' }} />
        <Bar dataKey="revenue" name="Revenue" fill={seriesPalette[0]} radius={[8, 8, 0, 0]} {...chartAnimation(reduced)} />
      </BarChart>
    </ResponsiveContainer>
  );
}


/** Live check of the data layer: the same hooks the pages use, against the backend or the demo fixtures. */
function DataLayerProbe() {
  const { datasetId, dataset } = useActiveDataset();
  const summary = useSummary(datasetId);
  const training = useTrainingJob(datasetId);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <GlassCard className="space-y-3">
        <p className="t-label">useSummary for {dataset?.filename ?? 'no dataset'}</p>
        <DataState
          query={summary}
          skeleton={<KpiSkeleton />}
          empty={<EmptyState bare title="No dataset yet" description="Upload a CSV, or switch Demo mode on." />}
        >
          {(data) => (
            <div className="grid grid-cols-2 gap-4">
              <KpiCard label="Total" value={data.kpis.total_target} format={formatInrCompact} />
              <KpiCard label="Rows" value={data.kpis.total_rows} />
            </div>
          )}
        </DataState>
      </GlassCard>
      <GlassCard className="space-y-3">
        <p className="t-label">useTrainingJob</p>
        <JobStatus phase={training.status} error={training.failureMessage ?? (training.error ? String(training.error.message) : null)} timedOut={training.timedOut} />
        <div className="flex gap-3">
          <Button variant="cta" size="sm" loading={training.isActive} disabled={!datasetId} onClick={training.start}>
            Retrain model
          </Button>
          <Button size="sm" onClick={training.reset} disabled={training.status === 'idle'}>
            Reset
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}

/* ─── Gallery ─── */

type PanelMode = 'loading' | 'empty' | 'error' | 'data';

export function KitGallery() {
  const { toast } = useToast();
  const { demoMode, setDemoMode } = useSettings();
  const [revenue, setRevenue] = useState(1_245_000);
  const [period, setPeriod] = useState<Period>('30');
  const [horizon, setHorizon] = useState('30');
  const [tab, setTab] = useState('overview');
  const [selectValue, setSelectValue] = useState<string | undefined>('a');
  const [slider, setSlider] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [file, setFile] = useState<string | null>(null);
  const [replay, setReplay] = useState(0);
  const [panelMode, setPanelMode] = useState<PanelMode>('data');
  const [phase, setPhase] = useState<TrainingPhase>('running');
  const [revealKey, setRevealKey] = useState(0);

  const panelQuery = {
    data: panelMode === 'data' ? { rows: 3 } : panelMode === 'empty' ? { rows: 0 } : undefined,
    isPending: panelMode === 'loading',
    isError: panelMode === 'error',
    error: panelMode === 'error' ? new ApiError({ status: 500, type: 'INTERNAL_ERROR', message: 'An internal error occurred while processing the request. If this persists, quote reference 3f2b8c1e-7a21-4f0e-9a52-0d1c2e3f4a01.', requestId: '3f2b8c1e-7a21-4f0e-9a52-0d1c2e3f4a01' }) : null,
    refetch: () => setPanelMode('data'),
  };

  return (
    <div className="space-y-12">
      <PageHeader
        title="Component kit"
        description="Every shared component in each of its states. Development only: this page does not exist in production builds."
        actions={<Switch label="Demo mode" checked={demoMode} onCheckedChange={setDemoMode} className="items-center" />}
      />

      <nav aria-label="Kit sections" className="flex flex-wrap gap-2 text-sm">
        {['buttons', 'badges', 'kpi', 'charts', 'controls', 'table', 'overlays', 'states', 'ai', 'upload', 'status', 'data', 'motion'].map((id) => (
          <a key={id} href={`#${id}`} className="rounded-full border border-border bg-surface-solid px-3 py-1 capitalize text-ink-2 transition-colors hover:border-primary hover:text-primary-ink">
            {id}
          </a>
        ))}
      </nav>

      <Section id="buttons" title="Buttons" note="Dark pill CTA, white secondary, text ghost. Hover the CTA for the sheen and arrow nudge; every button presses to 0.98.">
        <GlassCard className="space-y-6">
          <Row label="Variants">
            <Button variant="cta" arrow>
              Open dashboard
            </Button>
            <Button variant="secondary">See how it works</Button>
            <Button variant="ghost">Learn more</Button>
            <Button variant="danger">Delete dataset</Button>
          </Row>
          <Row label="Sizes">
            <Button variant="cta" size="sm">
              Small
            </Button>
            <Button variant="cta" size="md">
              Medium
            </Button>
            <Button variant="cta" size="lg" arrow>
              Large
            </Button>
          </Row>
          <Row label="States">
            <Button variant="cta" loading>
              Training
            </Button>
            <Button variant="secondary" disabled>
              Disabled
            </Button>
            <ButtonLink href="/dashboard" variant="secondary" arrow>
              As a link
            </ButtonLink>
          </Row>
        </GlassCard>
      </Section>

      <Section id="badges" title="Badges, chips and labels" note="Green means good, red means bad: never decoration. Purple means the model said it.">
        <GlassCard className="space-y-6">
          <Row label="Change badges">
            <ChangeBadge value={14.2} />
            <ChangeBadge value={-3.4} />
            <ChangeBadge value={0} />
            <ChangeBadge value={8.1} invert />
            <ChangeBadge value={5} label="+₹12,000" />
          </Row>
          <Row label="Source chips">
            <SourceChip source="data" confidence="high" />
            <SourceChip source="forecast" confidence="medium" />
            <SourceChip source="documents" />
            <SourceChip source="relationship" confidence="low" />
          </Row>
          <div className="space-y-2">
            <p className="t-label">Method labels</p>
            <MethodLabel method="prophet_component_decomposition" note="Prophet’s own components, shown as a share of the forecast." />
            <MethodLabel method="tree_shap" />
            <MethodLabel method="linear_coefficients" />
            <MethodLabel method="split_conformal" />
          </div>
          <Row label="Health pill (status bar)">
            <HealthPillView summary={summarizeHealth(healthy, null, false)} />
            <HealthPillView summary={summarizeHealth(degraded, null, false)} />
            <HealthPillView summary={summarizeHealth(dbDown, null, false)} />
            <HealthPillView summary={summarizeHealth(undefined, new Error('x'), false)} />
            <HealthPillView summary={summarizeHealth(undefined, null, true)} />
          </Row>
        </GlassCard>
      </Section>

      <Section id="kpi" title="KPI cards" note="Label → number → change badge. Numbers count up and tween on change. Tabular figures keep digits from jittering.">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Revenue" value={revenue} format={formatInrCompact} change={14.2} hint="vs previous 30 days" icon={<Banknote />} />
          <KpiCard label="Units sold" value={48210} change={-3.4} hint="vs previous 30 days" icon={<Boxes />} />
          <KpiCard label="Average order value" value={612} format={formatInr} change={0} icon={<Receipt />} />
          <KpiCard label="Growth" value={8.4} format={(v) => formatSignedPercent(v)} change={2.1} invertChange icon={<TrendingUp />} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button size="sm" onClick={() => setRevenue((v) => v + 380_000)}>
            Tween revenue up
          </Button>
          <Button size="sm" onClick={() => setRevenue((v) => Math.max(0, v - 520_000))}>
            Tween revenue down
          </Button>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <KpiSkeleton />
          <KpiSkeleton />
        </div>
      </Section>

      <Section id="charts" title="Charts" note="One shared theme: actuals blue, forecast purple, band purple at 12%. Lines draw left to right, the band fades in after, bars grow from the baseline.">
        <div className="grid gap-5 xl:grid-cols-2">
          <ChartCard
            title="Revenue forecast"
            description="Actual and forecast with an 80% range"
            summary="Daily revenue rose from about ₹1.8 L to ₹2.1 L over 36 days; the forecast continues near ₹2.1 L with a widening range."
            actions={<PeriodPicker value={period} onChange={setPeriod} />}
            footer="Intervals describe model error, not uncertainty about the levers."
          >
            <ForecastExample replay={replay} />
          </ChartCard>
          <ChartCard title="Revenue by category" description="Last 90 days" summary="Staples lead at ₹48 L, followed by Dairy at ₹34 L, Beverages at ₹28 L and Snacks at ₹20 L.">
            <BarExample replay={replay} />
          </ChartCard>
        </div>
        <Button size="sm" onClick={() => setReplay((n) => n + 1)}>
          Replay draw-in
        </Button>
        <ChartSkeleton />
      </Section>

      <Section id="controls" title="Form controls">
        <GlassCard className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-5">
            <Input label="Search term" placeholder="Basmati rice" hint="Plain input with a 3px focus ring." />
            <Input label="Question" defaultValue="hi" error="Ask something at least 5 characters long." />
            <Select
              label="Dataset"
              value={selectValue}
              onValueChange={setSelectValue}
              options={[
                { value: 'a', label: 'kirana_store_sales_2025.csv', description: '48,210 rows' },
                { value: 'b', label: 'pune_outlet_daily_sales.csv', description: '18,640 rows' },
              ]}
            />
          </div>
          <div className="space-y-6">
            <Slider label="Price change" value={slider} onValueChange={setSlider} min={-30} max={30} step={1} format={(v) => (v > 0 ? `+${v}%` : `${v}%`)} />
            <Row label="Segmented control (sliding pill)">
              <SegmentedControl
                label="Horizon"
                value={horizon}
                onValueChange={setHorizon}
                options={[
                  { value: '30', label: '30 days' },
                  { value: '60', label: '60 days' },
                  { value: '90', label: '90 days' },
                ]}
              />
            </Row>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="drivers">Drivers</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">Gliding underline between tabs.</TabsContent>
              <TabsContent value="drivers">Arrow keys move focus; Home and End jump.</TabsContent>
              <TabsContent value="notes">Each panel is announced to screen readers.</TabsContent>
            </Tabs>
            <Switch label="Demo mode" description="Switches are labelled and keyboard operable." checked={demoMode} onCheckedChange={setDemoMode} />
          </div>
        </GlassCard>
      </Section>

      <Section id="table" title="Table" note="Sortable (click a header), sticky header, scrolls sideways on narrow screens.">
        <DataTable columns={productColumns} rows={products} rowKey={(r) => r.name} caption="Top products by revenue" defaultSort={{ key: 'revenue', direction: 'desc' }} />
        <TableSkeleton />
      </Section>

      <Section id="overlays" title="Dialogs and toasts" note="Dialogs trap focus and return it to the button that opened them. Toasts are announced to screen readers.">
        <GlassCard className="space-y-4">
          <Row label="Dialog">
            <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              Delete dataset…
            </Button>
          </Row>
          <Row label="Toasts">
            <Button size="sm" onClick={() => toast({ title: 'Scenario saved', description: 'Raise prices 5% is ready to compare.', tone: 'success' })}>
              Success
            </Button>
            <Button size="sm" onClick={() => toast({ title: 'Upload failed', description: 'Only CSV files are supported.', tone: 'error' })}>
              Error
            </Button>
            <Button size="sm" onClick={() => toast({ title: 'Training started', tone: 'info' })}>
              Info
            </Button>
          </Row>
        </GlassCard>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title="Rename scenario" description="Give this scenario a name you will recognise later." footer={<Button variant="cta" size="sm" onClick={() => setDialogOpen(false)}>Done</Button>}>
          <Input label="Name" defaultValue="Raise prices 5%" />
        </Dialog>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Delete “kirana_store_sales_2025.csv”?"
          description="This permanently deletes the dataset and its trained forecasting model. It cannot be undone."
          confirmLabel="Delete dataset"
          destructive
          onConfirm={() => setConfirmOpen(false)}
        />
      </Section>

      <Section id="states" title="The four states" note="Every data panel is Loading, Empty, Error or Data. Pick one to see it cross-fade.">
        <SegmentedControl
          label="Panel state"
          value={panelMode}
          onValueChange={setPanelMode}
          options={[
            { value: 'loading', label: 'Loading' },
            { value: 'empty', label: 'Empty' },
            { value: 'error', label: 'Error' },
            { value: 'data', label: 'Data' },
          ]}
        />
        <DataState
          query={panelQuery}
          skeleton={<ChartSkeleton height={160} />}
          isEmpty={(d) => d.rows === 0}
          empty={<EmptyState title="No dataset yet" description="Upload a CSV of your sales to build your digital twin." action={<ButtonLink href="/upload" variant="cta" size="sm" arrow>Upload a CSV</ButtonLink>} />}
        >
          {(d) => (
            <GlassCard>
              <p className="text-ink">Data state: {d.rows} rows loaded.</p>
            </GlassCard>
          )}
        </DataState>
        <div className="grid gap-5 lg:grid-cols-2">
          <EmptyState title="No scenarios saved" description="Run a what-if on the Forecast page and press “Save scenario”." />
          <ErrorState
            error={new ApiError({ status: 0, type: 'BACKEND_UNREACHABLE', message: 'The CogniTwin backend is not reachable.' })}
            onRetry={() => toast({ title: 'Retrying…', tone: 'info' })}
          />
        </div>
        <GlassCard className="space-y-3">
          <p className="t-label">Skeleton text</p>
          <SkeletonText lines={3} />
          <Skeleton className="h-10 w-48" />
        </GlassCard>
      </Section>

      <Section id="ai" title="AI content" note="Purple is reserved for what the model said.">
        <InsightCard title="What to do this week">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Stock up on atta and rice before the weekend peaks.</li>
            <li>Test a 5% price rise on Sunflower Oil 1L.</li>
          </ol>
          <div className="flex flex-wrap gap-2 pt-1">
            <SourceChip source="forecast" confidence="medium" />
          </div>
        </InsightCard>
      </Section>

      <Section id="upload" title="Drop zone" note="Drag a file, click, or press Enter / Space when focused.">
        <div className="grid gap-5 lg:grid-cols-2">
          <DropZone accept=".csv" title="Drop a CSV here, or browse" hint="CSV up to 50 MB. We detect the date and sales columns for you." fileName={file} onFile={(f) => setFile(f.name)} />
          <DropZone accept=".csv" title="Drop a CSV here, or browse" error="Missing a date column. Add a column such as order_date and try again." onFile={() => {}} />
        </div>
      </Section>

      <Section id="status" title="Training progress" note="Queued → fitting → done. The bar shimmers while work is happening; success draws a check-mark.">
        <SegmentedControl
          label="Job phase"
          value={phase}
          onValueChange={setPhase}
          options={[
            { value: 'idle', label: 'Idle' },
            { value: 'queued', label: 'Queued' },
            { value: 'running', label: 'Fitting' },
            { value: 'succeeded', label: 'Done' },
            { value: 'failed', label: 'Failed' },
          ]}
        />
        <div className="max-w-xl">
          <JobStatus phase={phase} error="Need at least 30 data points; found 12." />
        </div>
      </Section>


      <Section id="data" title="Data layer" note="The hooks the pages use, run for real: against the backend, or the fixtures when Demo mode is on.">
        <DataLayerProbe />
      </Section>

      <Section id="motion" title="Motion" note="Hover a card to lift it. Reload the page to replay the page transition; replay the stagger below.">
        <Button size="sm" onClick={() => setRevealKey((n) => n + 1)}>
          Replay stagger
        </Button>
        <RevealGroup key={revealKey} className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <RevealItem key={n}>
              <GlassCard interactive>
                <p className="t-label">Card {n}</p>
                <p className="t-kpi mt-2">
                  <CountUp value={n * 12_480} format={formatInr} />
                </p>
              </GlassCard>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>
    </div>
  );
}
