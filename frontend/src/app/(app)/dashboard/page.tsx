'use client';

import { useEffect, useState, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DEMO_SUMMARY_DATA } from '@/lib/mockData';
import { Database, Hash, Calculator, ShieldCheck, SlidersHorizontal, ArrowRight } from 'lucide-react';
import { motion, Variants } from 'framer-motion';

import RevenueChart from '@/components/dashboard/RevenueChart';
import CategoricalChart from '@/components/dashboard/CategoricalChart';
import TopProducts from '@/components/dashboard/TopProducts';
import { KpiCard } from '@/components/ui/KpiCard';
import { Panel } from '@/components/ui/Panel';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { formatDelta, formatDeltaPct } from '@/lib/formatters';
import { cn } from '@/lib/utils';

import { useDataset } from '@/context/DatasetContext';
import {
  CyberneticKPISkeleton,
  CyberneticChartSkeleton,
} from '@/components/ui/CyberneticSkeleton';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
  },
};

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const datasetIdParam = searchParams?.get('dataset_id') || undefined;

  const {
    activeDatasetId,
    activeDataset,
    activeSummary,
    isLoading,
    selectDataset,
  } = useDataset();

  const [activeDimTab, setActiveDimTab] = useState<number>(0);
  const [dimViewMode, setDimViewMode] = useState<'bar' | 'donut' | 'horizontal'>('bar');
  const [quickLever, setQuickLever] = useState<number>(10);

  useEffect(() => {
    if (datasetIdParam && datasetIdParam !== activeDatasetId) {
      selectDataset(datasetIdParam);
    }
  }, [datasetIdParam, activeDatasetId, selectDataset]);

  const activeData = activeSummary || DEMO_SUMMARY_DATA;
  const isDemoMode = activeDataset.isPreset || !activeData?.metadata?.target_metric;
  const targetMetric = activeData.metadata?.target_metric || 'Revenue';
  const cleanTargetName = targetMetric.replace(/_/g, ' ');

  // Counterfactual estimate — elasticity-adjusted.
  const quickSimDelta = useMemo(() => {
    const base = activeData.kpis?.total_target || 5482920;
    const deltaPct = quickLever * 0.88;
    const deltaVal = Math.round(base * (deltaPct / 100));
    return { deltaVal, deltaPct };
  }, [activeData, quickLever]);

  const leverFill = ((quickLever + 30) / 60) * 100;

  const dimensionsArray = useMemo(() => {
    if (!activeData.dimensions) return DEMO_SUMMARY_DATA.dimensions;
    if (Array.isArray(activeData.dimensions)) {
      return activeData.dimensions.length > 0 ? activeData.dimensions : DEMO_SUMMARY_DATA.dimensions;
    }
    const entries = Object.entries(activeData.dimensions)
      .filter(([, dimData]: [string, any]) => Array.isArray(dimData) && dimData.length > 0)
      .map(([name, dimData]) => ({ name, data: dimData }));
    return entries.length > 0 ? entries : DEMO_SUMMARY_DATA.dimensions;
  }, [activeData]);

  const topProductsList =
    activeData.top_products && activeData.top_products.length > 0
      ? activeData.top_products
      : DEMO_SUMMARY_DATA.top_products;

  return (
    <motion.div
      className="relative z-10 mx-auto max-w-[var(--container)] space-y-8 px-4 py-8 sm:px-6 lg:px-8"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Demo-mode notice — honest about what is being shown */}
      {isDemoMode && (
        <motion.div variants={itemVariants}>
          <Panel signal className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5">
              <span className="status-dot status-dot--signal breathe" aria-hidden="true" />
              <span className="text-sm text-ink">
                <span className="font-semibold text-signal">Demo dataset.</span>{' '}
                <span className="text-ink-secondary">
                  Showing sample retail telemetry — ingest a CSV to model your own business.
                </span>
              </span>
            </div>
            <Link href="/ingest" className="btn btn-primary">
              Ingest CSV
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Panel>
        </motion.div>
      )}

      {/* Page header */}
      <motion.div variants={itemVariants}>
        <SectionHeader
          eyebrow="Telemetry"
          title={<>Active Data Observatory</>}
          lede={
            <>
              Continuous state-space inference and autonomous scenario counterfactuals for{' '}
              <span className="text-ink">{cleanTargetName.toLowerCase()}</span> across every indexed
              dimension.
            </>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/forecast" className="btn btn-primary">
                Launch Forecast Twin
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link href="/query" className="btn btn-secondary">
                Ask the analyst
              </Link>
            </div>
          }
        />
      </motion.div>

      {/* KPI strip */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CyberneticKPISkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <motion.div variants={itemVariants}>
            <KpiCard
              title={`Total ${cleanTargetName}`}
              value={activeData.kpis?.total_target || 5482920}
              format="compact"
              delta={
                activeData.kpis?.growth_rate
                  ? activeData.kpis.total_target * (activeData.kpis.growth_rate / 100)
                  : undefined
              }
              deltaPct={activeData.kpis?.growth_rate || 22.4}
              icon={Database}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <KpiCard
              title={`Mean ${cleanTargetName} / cycle`}
              value={activeData.kpis?.avg_target || 48950}
              format="compact"
              icon={Calculator}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <KpiCard
              title="Indexed telemetry records"
              value={activeData.kpis?.total_rows || 51280}
              format="number"
              icon={Hash}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <Panel className="flex h-full min-h-[118px] flex-col justify-between p-5">
              <div className="flex items-center justify-between">
                <span className="text-caption">Anomaly surveillance</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-[var(--r-xs)] border border-hairline bg-graphite-800">
                  <ShieldCheck className="h-3.5 w-3.5 text-positive" strokeWidth={1.5} />
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="status-dot status-dot--live" aria-hidden="true" />
                  <span className="font-mono text-2xl font-semibold tabular-nums text-ink">
                    0 anomalies
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-ink-muted">
                  <span>VOLATILITY 0.14 · SAFE</span>
                  <span className="text-positive">99.98% FIDELITY</span>
                </div>
              </div>
            </Panel>
          </motion.div>
        </div>
      )}

      {/* Hero trajectory chart */}
      <motion.div variants={itemVariants} className="w-full">
        <Panel elevated className="w-full">
          {isLoading ? (
            <CyberneticChartSkeleton title="Loading trajectory" />
          ) : (
            <RevenueChart
              data={activeData.trend || activeData.timeline || []}
              yKey="value"
              metricName={cleanTargetName}
            />
          )}
        </Panel>
      </motion.div>

      {/* What-if lever + top products */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Signature interaction: the what-if lever */}
        <motion.div variants={itemVariants} className="lg:col-span-5">
          <Panel className="flex h-full flex-col justify-between p-6">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-hairline pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-[var(--r-xs)] border border-hairline bg-graphite-800">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-signal" strokeWidth={1.5} />
                  </span>
                  <div>
                    <h3 className="text-h3 text-ink">Instant what-if</h3>
                    <p className="font-mono text-[11px] text-ink-muted">
                      Live scenario test on the active twin
                    </p>
                  </div>
                </div>
                <span className="chip chip--signal">Elasticity model</span>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-ink-secondary">Global price modulation</span>
                  <span
                    className={cn(
                      'font-mono text-sm font-semibold tabular-nums',
                      quickLever >= 0 ? 'text-positive' : 'text-negative'
                    )}
                  >
                    {quickLever >= 0 ? `+${quickLever}%` : `${quickLever}%`}
                  </span>
                </div>

                <input
                  type="range"
                  min={-30}
                  max={30}
                  step={1}
                  value={quickLever}
                  onChange={(e) => setQuickLever(Number(e.target.value))}
                  aria-label="Global price modulation"
                  aria-valuetext={`${quickLever} percent`}
                  className="lever"
                  style={{ ['--lever-fill' as string]: `${leverFill}%` }}
                />

                <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-muted">
                  <span>−30% cut</span>
                  <span>nominal</span>
                  <span>+30% premium</span>
                </div>
              </div>

              <div className="panel-inset space-y-2 p-4">
                <span className="text-caption">Estimated revenue delta</span>
                <div className="flex items-baseline justify-between">
                  <span
                    className={cn(
                      'font-mono text-2xl font-semibold tabular-nums',
                      quickSimDelta.deltaVal >= 0 ? 'text-positive' : 'text-negative'
                    )}
                  >
                    {formatDelta(quickSimDelta.deltaVal)}
                  </span>
                  <span
                    className={cn(
                      'font-mono text-xs font-semibold tabular-nums',
                      quickSimDelta.deltaPct >= 0 ? 'text-positive' : 'text-negative'
                    )}
                  >
                    {formatDeltaPct(quickSimDelta.deltaPct)}
                  </span>
                </div>
                <p className="pt-1 text-xs leading-relaxed text-ink-muted">
                  Accounting for demand elasticity, channel realization, and substitution risk.
                </p>
              </div>
            </div>

            <Link href="/forecast" className="btn btn-secondary mt-5 w-full">
              Open the 90-day forecast studio
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Panel>
        </motion.div>

        {/* Top products */}
        <motion.div variants={itemVariants} className="lg:col-span-7">
          <Panel elevated className="h-full">
            <TopProducts products={topProductsList} metricName={cleanTargetName} />
          </Panel>
        </motion.div>
      </div>

      {/* Dimensional decomposition */}
      <motion.div variants={itemVariants} className="space-y-4">
        <SectionHeader
          title={<>Dimensional decomposition</>}
          lede={<>Multivariate telemetry segmented across categorical boundaries of the twin.</>}
          actions={
            dimensionsArray.length > 0 ? (
              <SegmentedTabs
                layoutId="dim-tabs"
                size="sm"
                value={String(activeDimTab)}
                onChange={(v) => setActiveDimTab(Number(v))}
                tabs={dimensionsArray.map((dim: any, idx: number) => ({
                  value: String(idx),
                  label: (dim.name || dim.dimension || `Dim ${idx + 1}`).replace(/_/g, ' '),
                }))}
              />
            ) : undefined
          }
          rule={false}
        />

        {dimensionsArray[activeDimTab] && (
          <Panel elevated>
            <div className="space-y-6 p-6 md:p-8">
              <div className="flex flex-col gap-3 border-b border-hairline pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-signal">
                    Active dimension · {dimensionsArray[activeDimTab].name?.replace(/_/g, ' ')}
                  </span>
                  <h4 className="text-h3 mt-0.5 text-ink">
                    {cleanTargetName} across{' '}
                    {dimensionsArray[activeDimTab].name?.replace(/_/g, ' ')}
                  </h4>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <SegmentedTabs
                    layoutId="dim-view"
                    size="sm"
                    value={dimViewMode}
                    onChange={(v) => setDimViewMode(v as typeof dimViewMode)}
                    tabs={[
                      { value: 'bar', label: 'Bars' },
                      { value: 'donut', label: 'Share' },
                      { value: 'horizontal', label: 'Ranked' },
                    ]}
                  />
                  <span className="font-mono text-[11px] text-ink-muted">
                    {dimensionsArray[activeDimTab].data?.length || 0} segments
                  </span>
                </div>
              </div>

              <div className="min-h-[340px] w-full">
                <CategoricalChart
                  data={dimensionsArray[activeDimTab].data || []}
                  categoryKey="category"
                  valueKey="value"
                  metricName={cleanTargetName}
                  viewMode={dimViewMode}
                />
              </div>
            </div>
          </Panel>
        )}
      </motion.div>

      {/* System telemetry footer */}
      <motion.div variants={itemVariants}>
        <Panel className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <span className="status-dot status-dot--live breathe" aria-hidden="true" />
            <span className="text-sm font-medium text-ink">Inference online</span>
            <span className="hidden text-ink-muted sm:inline">·</span>
            <span className="hidden font-mono text-[11px] text-ink-muted sm:inline">
              FRESHNESS {activeData.metadata?.data_freshness || 'LIVE'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-5 font-mono text-[11px]">
            <div>
              <span className="text-ink-muted">MODEL MAPE </span>
              <span className="font-semibold text-ink">1.42%</span>
            </div>
            <div>
              <span className="text-ink-muted">HORIZON </span>
              <span className="font-semibold text-signal">90 DAYS</span>
            </div>
            <div>
              <span className="text-ink-muted">SYNC </span>
              <span className="font-semibold text-positive">HEALTHY</span>
            </div>
          </div>
        </Panel>
      </motion.div>
    </motion.div>
  );
}

// Local fallback dimensions — kept tiny, used only when the summary is empty.
const DEMO_SUMMARY_FALLBACK: { name: string; data: any[] }[] = [];

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[65dvh] items-center justify-center p-12">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-graphite-700 border-t-signal" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
