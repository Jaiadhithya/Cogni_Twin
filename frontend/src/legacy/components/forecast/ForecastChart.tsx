'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDelta,
  formatDeltaPct,
} from '@/legacy/lib/formatters';
import { CHART_COLORS, tooltipStyles } from '@/legacy/lib/chartTheme';

interface ChartPoint {
  date: string;
  actual?: number | null;
  predicted?: number | null;
  lower_bound?: number | null;
  upper_bound?: number | null;
}

interface SimulationPoint {
  date: string;
  baseline_predicted: number;
  mutated_predicted: number;
  delta: number;
  delta_pct: number;
}

interface ForecastChartProps {
  chartData: ChartPoint[];
  simulationData?: SimulationPoint[] | null;
  summary?: any;
}

/** Merged series the chart actually plots, with band/sim areas decomposed into a
 *  stackable base+height pair (recharts renders bands as stacked areas). */
interface PlotPoint extends ChartPoint {
  bandBase: number;
  bandHeight: number;
  simBase: number;
  simHeight: number;
  sim?: SimulationPoint;
}

function formatTickDate(value: any) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

export default function ForecastChart({
  chartData,
  simulationData,
  summary,
}: ForecastChartProps) {
  const targetMetric = summary?.metadata?.target_metric || 'revenue';
  const isCurrency = /price|sales|revenue/i.test(targetMetric);

  const formatDynamic = (val: number) => {
    if (isCurrency) return formatCurrency(val);
    return Number(val).toLocaleString('en-US');
  };

  const formatDynamicCompact = (val: number) => {
    if (isCurrency) return formatCurrencyCompact(val);
    return Number(val).toLocaleString('en-US', { notation: 'compact' });
  };

  const simMap = useMemo(() => {
    if (!simulationData) return new Map<string, SimulationPoint>();
    return new Map(simulationData.map((s) => [s.date, s]));
  }, [simulationData]);

  const plotData: PlotPoint[] = useMemo(() => {
    return chartData.map((d) => {
      const lower = d.lower_bound ?? null;
      const upper = d.upper_bound ?? null;
      const bandBase = lower != null && upper != null ? lower : 0;
      const bandHeight = lower != null && upper != null ? Math.max(0, upper - lower) : 0;

      const sim = simMap.get(d.date);
      let simBase = 0;
      let simHeight = 0;
      if (sim) {
        simBase = Math.min(sim.baseline_predicted, sim.mutated_predicted);
        simHeight = Math.abs(sim.mutated_predicted - sim.baseline_predicted);
      }

      return { ...d, bandBase, bandHeight, simBase, simHeight, sim };
    });
  }, [chartData, simMap]);

  const simPositive = (simulationData?.[0]?.delta ?? 0) >= 0;

  const hasSimulation = !!simulationData && simulationData.length > 0;

  return (
    <div className="relative w-full">
      <ResponsiveContainer width="100%" height={440} debounce={10}>
        <ComposedChart
          data={plotData}
          margin={{ top: 24, right: 24, bottom: 16, left: 8 }}
          role="img"
          aria-label="Forecast trajectory with confidence corridor"
        >
          <defs>
            <linearGradient id="grad-confidence" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.bandStrong} />
              <stop offset="100%" stopColor={CHART_COLORS.band} />
            </linearGradient>
            <linearGradient id="grad-history" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(245, 243, 239, 0.07)" />
              <stop offset="100%" stopColor="rgba(245, 243, 239, 0)" />
            </linearGradient>
            <linearGradient id="grad-sim-surplus" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(52, 211, 153, 0.22)" />
              <stop offset="100%" stopColor="rgba(52, 211, 153, 0)" />
            </linearGradient>
            <linearGradient id="grad-sim-deficit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(248, 113, 113, 0.22)" />
              <stop offset="100%" stopColor="rgba(248, 113, 113, 0)" />
            </linearGradient>
          </defs>

          <CartesianGrid
            horizontal
            vertical={false}
            stroke={CHART_COLORS.grid}
            strokeDasharray="3 3"
          />

          <XAxis
            dataKey="date"
            tickFormatter={formatTickDate}
            stroke={CHART_COLORS.gridStrong}
            tickLine={false}
            minTickGap={24}
            tick={{ fill: CHART_COLORS.axis, fontSize: 10, fontFamily: 'var(--font-jetbrains-mono), monospace' }}
          />
          <YAxis
            tickFormatter={formatDynamicCompact}
            stroke="transparent"
            tickLine={false}
            width={64}
            allowDataOverflow
            tick={{ fill: CHART_COLORS.axis, fontSize: 10, fontFamily: 'var(--font-jetbrains-mono), monospace' }}
          />
          <Tooltip
            cursor={{ stroke: CHART_COLORS.crosshair, strokeWidth: 1, strokeDasharray: '3 3' }}
            content={<ForecastTooltip isCurrency={isCurrency} formatDynamic={formatDynamic} formatDynamicCompact={formatDynamicCompact} />}
          />

          {/* Confidence corridor: stacked transparent base + visible band height */}
          <Area
            dataKey="bandBase"
            stackId="band"
            stroke="none"
            fill="transparent"
            isAnimationActive={false}
            legendType="none"
            dot={false}
          />
          <Area
            dataKey="bandHeight"
            stackId="band"
            stroke="none"
            fill="url(#grad-confidence)"
            isAnimationActive={false}
            dot={false}
          />

          {/* Historical actual area */}
          <Area
            dataKey="actual"
            stroke="none"
            fill="url(#grad-history)"
            isAnimationActive={false}
            dot={false}
            connectNulls
          />

          {hasSimulation && (
            <>
              <Area
                dataKey="simBase"
                stackId="sim"
                stroke="none"
                fill="transparent"
                isAnimationActive={false}
                legendType="none"
                dot={false}
              />
              <Area
                dataKey="simHeight"
                stackId="sim"
                stroke="none"
                fill={simPositive ? 'url(#grad-sim-surplus)' : 'url(#grad-sim-deficit)'}
                isAnimationActive={false}
                dot={false}
              />
            </>
          )}

          {/* Historical trace — ink */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke="rgba(245, 243, 239, 0.62)"
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />

          {/* Forecast trace — the amber signal */}
          <Line
            type="monotone"
            dataKey="predicted"
            stroke={CHART_COLORS.trace}
            strokeWidth={2.25}
            dot={false}
            isAnimationActive={false}
          />

          {hasSimulation && (
            <Line
              type="monotone"
              dataKey="mutated_predicted"
              stroke={simPositive ? CHART_COLORS.positive : CHART_COLORS.negative}
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-5 font-mono text-[11px] text-ink-muted">
        <div className="flex items-center gap-2">
          <span className="h-[2px] w-4 rounded-full bg-ink/60" />
          <span>Historical</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-[2px] w-4 rounded-full bg-signal" />
          <span className="text-signal">Prophet baseline</span>
        </div>
        {hasSimulation && (
          <div className="flex items-center gap-2">
            <span className={`h-[2px] w-4 rounded-full ${simPositive ? 'bg-positive' : 'bg-negative'}`} />
            <span className={simPositive ? 'text-positive' : 'text-negative'}>Simulated scenario</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="h-3 w-4 rounded-[2px] border border-hairline-signal bg-signal/20" />
          <span>Confidence envelope</span>
        </div>
      </div>
    </div>
  );
}

function ForecastTooltip({
  active,
  payload,
  isCurrency,
  formatDynamic,
  formatDynamicCompact,
}: {
  active?: boolean;
  payload?: any[];
  isCurrency: boolean;
  formatDynamic: (val: number) => string;
  formatDynamicCompact: (val: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload as PlotPoint;
  if (!point) return null;

  return (
    <div style={tooltipStyles} className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 border-b border-hairline pb-1">
        <span className="text-[10px] text-ink-secondary">
          {new Date(point.date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
        <span className="text-[10px] uppercase tracking-[0.1em] text-signal">
          {point.actual != null ? 'Historical' : 'Forecast'}
        </span>
      </div>

      {point.actual != null && (
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="text-ink-muted">Actual</span>
          <span className="font-mono font-semibold text-ink">{formatDynamic(point.actual)}</span>
        </div>
      )}

      {point.predicted != null && (
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="text-signal">Projected</span>
          <span className="font-mono font-semibold text-ink">{formatDynamic(point.predicted)}</span>
        </div>
      )}

      {point.sim && (
        <div className="space-y-1 border-t border-hairline pt-1.5">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className={point.sim.delta >= 0 ? 'text-positive' : 'text-negative'}>
              Mutated twin
            </span>
            <span className="font-mono font-semibold text-ink">
              {formatDynamic(point.sim.mutated_predicted)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="text-ink-muted">Scenario shift</span>
            <span
              className={`font-mono font-semibold ${point.sim.delta >= 0 ? 'text-positive' : 'text-negative'}`}
            >
              {formatDelta(point.sim.delta)} ({formatDeltaPct(point.sim.delta_pct)})
            </span>
          </div>
        </div>
      )}

      {point.lower_bound != null && point.upper_bound != null && (
        <div className="flex justify-between border-t border-hairline pt-1 font-mono text-[10px] text-ink-muted">
          <span>80% CI</span>
          <span>
            {formatDynamicCompact(point.lower_bound)} – {formatDynamicCompact(point.upper_bound)}
          </span>
        </div>
      )}
    </div>
  );
}
