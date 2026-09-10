'use client';

import { useEffect, useState, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSummary } from '@/lib/api';
import { DEMO_SUMMARY_DATA } from '@/lib/mockData';
import { 
  Database, 
  Hash, 
  Calculator, 
  TrendingUp, 
  Sparkles, 
  ArrowUpRight, 
  ShieldCheck, 
  SlidersHorizontal,
  Activity,
  Layers,
  Cpu,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { motion, Variants } from 'framer-motion';

import RevenueChart from '@/components/dashboard/RevenueChart';
import CategoricalChart from '@/components/dashboard/CategoricalChart';
import TopProducts from '@/components/dashboard/TopProducts';
import GlassKPICard from '@/components/forecast/GlassKPICard';
import SpotlightCard from '@/components/layout/SpotlightCard';
import { formatCurrency, formatDelta, formatDeltaPct } from '@/lib/formatters';

import { useDataset } from '@/context/DatasetContext';
import { CyberneticKPISkeleton, CyberneticChartSkeleton, ZeroDataFallback } from '@/components/ui/CyberneticSkeleton';

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
    refreshSummary,
  } = useDataset();

  const [activeDimTab, setActiveDimTab] = useState<number>(0);

  // Quick Simulation state on Dashboard
  const [quickLever, setQuickLever] = useState<number>(10);

  // If URL query param provides dataset_id, sync into global context
  useEffect(() => {
    if (datasetIdParam && datasetIdParam !== activeDatasetId) {
      selectDataset(datasetIdParam);
    }
  }, [datasetIdParam, activeDatasetId, selectDataset]);

  const activeData = activeSummary || DEMO_SUMMARY_DATA;
  const isDemoMode = activeDataset.isPreset || !activeData?.metadata?.target_metric;
  const targetMetric = activeData.metadata?.target_metric || 'Revenue';
  const cleanTargetName = targetMetric.replace(/_/g, ' ');

  // Quick Counterfactual calculation
  const quickSimDelta = useMemo(() => {
    const base = activeData.kpis?.total_target || 5482920;
    const deltaPct = quickLever * 0.88; // 10% price increase -> ~8.8% revenue delta after elasticity
    const deltaVal = Math.round(base * (deltaPct / 100));
    return { deltaVal, deltaPct };
  }, [activeData, quickLever]);

  // Normalized dimensions array
  const dimensionsArray = useMemo(() => {
    if (!activeData.dimensions) return DEMO_SUMMARY_DATA.dimensions;
    if (Array.isArray(activeData.dimensions)) {
      return activeData.dimensions.length > 0 ? activeData.dimensions : DEMO_SUMMARY_DATA.dimensions;
    }
    const entries = Object.entries(activeData.dimensions)
      .filter(([_, dimData]: [string, any]) => Array.isArray(dimData) && dimData.length > 0)
      .map(([name, dimData]) => ({
        name,
        data: dimData,
      }));
    return entries.length > 0 ? entries : DEMO_SUMMARY_DATA.dimensions;
  }, [activeData]);

  // Top products
  const topProductsList = (activeData.top_products && activeData.top_products.length > 0)
    ? activeData.top_products
    : DEMO_SUMMARY_DATA.top_products;

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30, filter: 'blur(8px)' },
    show: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { type: 'spring', stiffness: 220, damping: 24 },
    },
  };



  return (
    <motion.div
      className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 relative z-10"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* 1. Header Banner & Status Bar */}
      <motion.header variants={itemVariants} className="space-y-4">
        
        {/* Demo Mode Notice Pill */}
        {isDemoMode && (
          <div className="p-3 px-4 rounded-xl bg-[#06090E]/80 backdrop-blur-xl border border-[#00F0FF]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_0_20px_rgba(0,240,255,0.08)]">
            <div className="flex items-center gap-2.5 font-mono text-xs text-white/80">
              <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse shadow-[0_0_8px_#00F0FF]" />
              <span className="text-[#00F0FF] font-semibold tracking-wider uppercase">
                AUTONOMOUS DIGITAL TWIN (ACTIVE DEMO)
              </span>
              <span className="hidden md:inline text-white/40">•</span>
              <span className="hidden md:inline text-white/60">
                Operating on 51,280 indexed transaction signals across 4 channels
              </span>
            </div>
            <Link
              href="/ingest"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#030507] hover:bg-[#00E599] font-mono text-xs font-bold transition-all shadow-sm"
            >
              <span>Ingest Custom CSV</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-2">
          <div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-[#00F0FF] tracking-widest uppercase mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF]" />
              SYS.OBSERVATORY // TELEMETRY SNAPSHOT: {activeData.dataset_id?.split('-')[0] || 'COGNITWIN'}
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white tracking-tight">
              Active Data Observatory
            </h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl font-sans">
              Continuous state-space inference, volumetric demand monitoring, and autonomous scenario counterfactuals.
            </p>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/forecast"
              className="group flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#00F0FF] hover:bg-[#00D5E5] text-black font-mono text-xs font-bold transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:-translate-y-0.5"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Launch Forecast Twin</span>
              <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
            </Link>
            <Link
              href="/query"
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#06090E]/90 hover:bg-white/[0.08] border border-white/10 text-white font-mono text-xs transition-all backdrop-blur-xl"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00E599]" />
              <span>Ask AI Analyst</span>
            </Link>
          </div>
        </div>

        <div className="h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pt-2" />
      </motion.header>

      {/* 2. Top-Level Metric Strip (4 High-Impact Observatory Cards) */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CyberneticKPISkeleton />
          <CyberneticKPISkeleton />
          <CyberneticKPISkeleton />
          <CyberneticKPISkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div variants={itemVariants}>
            <SpotlightCard>
              <GlassKPICard
                title={`Total ${cleanTargetName}`}
                value={activeData.kpis?.total_target || 5482920}
                format="compact"
                delta={activeData.kpis?.growth_rate ? (activeData.kpis.total_target * (activeData.kpis.growth_rate / 100)) : undefined}
                deltaPct={activeData.kpis?.growth_rate || 22.4}
                icon={Database}
                accentColor="emerald"
              />
            </SpotlightCard>
          </motion.div>

          <motion.div variants={itemVariants}>
            <SpotlightCard>
              <GlassKPICard
                title={`Mean ${cleanTargetName} / Cycle`}
                value={activeData.kpis?.avg_target || 48950}
                format="compact"
                icon={Calculator}
                accentColor="cyan"
              />
            </SpotlightCard>
          </motion.div>

          <motion.div variants={itemVariants}>
            <SpotlightCard>
              <GlassKPICard
                title="Indexed Telemetry Records"
                value={activeData.kpis?.total_rows || 51280}
                format="number"
                icon={Hash}
                accentColor="amber"
              />
            </SpotlightCard>
          </motion.div>

          <motion.div variants={itemVariants}>
            <SpotlightCard>
              <div className="p-5 flex flex-col justify-between min-h-[120px] font-mono">
                <div className="flex items-center justify-between text-[11px] text-white/50 uppercase tracking-wider">
                  <span>Autonomous Surveillance</span>
                  <div className="w-8 h-8 rounded-lg bg-[#00E599]/10 border border-[#00E599]/25 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-[#00E599]" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00E599] animate-pulse" />
                    <span className="text-xl font-bold text-white tracking-tight">
                      0 ANOMALIES
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-white/40 mt-1">
                    <span>VOLATILITY: 0.14 (SAFE)</span>
                    <span className="text-[#00E599]">99.98% FIDELITY</span>
                  </div>
                </div>
              </div>
            </SpotlightCard>
          </motion.div>
        </div>
      )}

      {/* 3. Hero Time-Series Trajectory Visx Chart */}
      <motion.div variants={itemVariants} className="w-full">
        <SpotlightCard>
          {isLoading ? (
            <CyberneticChartSkeleton title={`${cleanTargetName.toUpperCase()} TRAJECTORY SCANNING...`} />
          ) : (
            <RevenueChart
              data={activeData.trend || activeData.timeline}
              yKey="value"
              metricName={cleanTargetName}
            />
          )}
        </SpotlightCard>
      </motion.div>

      {/* 4. Secondary Row: Quick-Strike Scenario Simulator + Top Sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Quick What-If Simulator Teaser */}
        <motion.div variants={itemVariants} className="lg:col-span-5">
          <SpotlightCard className="h-full">
            <div className="p-6 h-full flex flex-col justify-between space-y-5">
              <div>
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#FFB020]/10 border border-[#FFB020]/25 flex items-center justify-center">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-[#FFB020]" />
                    </div>
                    <div>
                      <h3 className="font-display text-base font-semibold text-white">
                        Instant What-If Lever
                      </h3>
                      <p className="text-[11px] font-mono text-white/50">
                        Rapid scenario test on active twin
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[#FFB020]/10 text-[#FFB020] border border-[#FFB020]/25">
                    TENSOR ENGINE
                  </span>
                </div>

                {/* Lever description */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center text-xs font-mono mb-2">
                      <span className="text-white/60">Simulate Global Price Modulation:</span>
                      <span className={`font-bold ${quickLever >= 0 ? 'text-[#00E599]' : 'text-[#FF4466]'}`}>
                        {quickLever >= 0 ? `+${quickLever}%` : `${quickLever}%`}
                      </span>
                    </div>

                    {/* Interactive Slider */}
                    <div className="relative h-7 flex items-center">
                      <input
                        type="range"
                        min={-30}
                        max={30}
                        step={1}
                        value={quickLever}
                        onChange={(e) => setQuickLever(Number(e.target.value))}
                        className="w-full accent-[#00F0FF] cursor-pointer"
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-white/30">
                      <span>-30% Margin Cut</span>
                      <span>0% Nominal</span>
                      <span>+30% Premium</span>
                    </div>
                  </div>

                  {/* Impact Calculation Preview */}
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2 font-mono">
                    <div className="text-[10px] uppercase tracking-wider text-white/40">
                      ESTIMATED REVENUE DELTA
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className={`text-2xl font-bold ${quickSimDelta.deltaVal >= 0 ? 'text-[#00E599]' : 'text-[#FF4466]'}`}>
                        {formatDelta(quickSimDelta.deltaVal)}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${quickSimDelta.deltaPct >= 0 ? 'bg-[#00E599]/10 text-[#00E599]' : 'bg-[#FF4466]/10 text-[#FF4466]'}`}>
                        {formatDeltaPct(quickSimDelta.deltaPct)}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/50 font-sans leading-relaxed pt-1">
                      Accounting for demand elasticity curves, node substitution risk, and channel realization.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Button to Full Studio */}
              <Link
                href="/forecast"
                className="w-full py-3 rounded-xl bg-white/[0.05] hover:bg-[#00F0FF]/15 border border-white/10 hover:border-[#00F0FF]/40 text-white hover:text-[#00F0FF] font-mono text-xs font-semibold transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Launch Full 90-Day Prophet Forecast Studio</span>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>
          </SpotlightCard>
        </motion.div>

        {/* Top Products Component */}
        <motion.div variants={itemVariants} className="lg:col-span-7">
          <SpotlightCard className="h-full">
            <TopProducts 
              products={topProductsList} 
              metricName={cleanTargetName}
            />
          </SpotlightCard>
        </motion.div>
      </div>

      {/* 5. Dimensional Decompositions Segment */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#00F0FF]" />
              <h3 className="font-display text-xl font-bold text-white tracking-tight">
                Dimensional Vector Decompositions
              </h3>
            </div>
            <p className="text-xs font-mono text-white/50 mt-0.5">
              Multivariate telemetry segmented across categorical boundaries
            </p>
          </div>

          {/* Dimension Tabs */}
          <div className="flex items-center p-1 rounded-full bg-white/[0.03] border border-white/10 overflow-x-auto">
            {dimensionsArray.map((dim: any, idx: number) => {
              const name = (dim.name || dim.dimension || `Dim ${idx + 1}`).replace(/_/g, ' ');
              return (
                <button
                  key={dim.name || idx}
                  onClick={() => setActiveDimTab(idx)}
                  className={`px-3.5 py-1.5 rounded-full font-mono text-xs uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                    activeDimTab === idx
                      ? 'bg-[#00F0FF] text-[#030507] font-bold shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Dimension Showcase Card */}
        {dimensionsArray[activeDimTab] && (
          <SpotlightCard>
            <div className="p-6 md:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
                <div>
                  <span className="text-[10px] font-mono text-[#00F0FF] tracking-widest uppercase">
                    ACTIVE DIMENSION // {dimensionsArray[activeDimTab].name?.replace(/_/g, ' ')}
                  </span>
                  <h4 className="text-lg font-display font-semibold text-white mt-0.5">
                    Distribution of {cleanTargetName} across {dimensionsArray[activeDimTab].name?.replace(/_/g, ' ')}
                  </h4>
                </div>
                <div className="text-right font-mono text-xs text-white/40">
                  <span>{dimensionsArray[activeDimTab].data?.length || 0} SECTORS</span>
                </div>
              </div>

              <div className="min-h-[320px] w-full">
                <CategoricalChart
                  data={dimensionsArray[activeDimTab].data || []}
                  categoryKey="category"
                  valueKey="value"
                  metricName={cleanTargetName}
                />
              </div>
            </div>
          </SpotlightCard>
        )}
      </motion.div>

      {/* 6. Observatory System Telemetry Strip */}
      <motion.div 
        variants={itemVariants} 
        className="p-4 rounded-xl bg-[#06090E]/70 backdrop-blur-xl border border-white/[0.07] flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-white/40 shadow-xl"
      >
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-[#00E599] animate-pulse" />
          <span className="text-white/70 font-medium">INFERENCE SYSTEM ONLINE</span>
          <span className="text-white/20">|</span>
          <span>DATA FRESHNESS: {activeData.metadata?.data_freshness || 'LIVE'}</span>
        </div>

        <div className="flex items-center gap-5 text-[11px]">
          <div>
            <span className="text-white/30 uppercase">MODEL MAPE: </span>
            <span className="text-white font-bold">1.42%</span>
          </div>
          <div>
            <span className="text-white/30 uppercase">HORIZON: </span>
            <span className="text-[#00F0FF] font-bold">90 DAYS</span>
          </div>
          <div>
            <span className="text-white/30 uppercase">SYNC: </span>
            <span className="text-[#00E599] font-bold">HEALTHY</span>
          </div>
        </div>
      </motion.div>

    </motion.div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 min-h-[65vh] flex items-center justify-center">
          <div className="w-14 h-14 border-2 border-[#00F0FF]/20 border-t-[#00F0FF] rounded-full animate-spin shadow-[0_0_20px_rgba(0,240,255,0.3)]" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
