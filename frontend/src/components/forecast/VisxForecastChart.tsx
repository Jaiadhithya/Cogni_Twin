'use client';

import { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Group } from '@visx/group';
import { AreaClosed, line } from '@visx/shape';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { LinearGradient } from '@visx/gradient';
import { curveMonotoneX } from '@visx/curve';
import { useTooltip, TooltipWithBounds } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { bisector } from 'd3-array';
import { formatCurrency, formatCurrencyCompact, formatDelta, formatDeltaPct } from '@/lib/formatters';
import { CHART_COLORS, tooltipStyles, axisTickProps } from '@/lib/chartTheme';

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

interface VisxForecastChartProps {
  chartData: ChartPoint[];
  simulationData?: SimulationPoint[] | null;
  width?: number;
  height?: number;
  summary?: any;
}

const MARGIN = { top: 24, right: 24, bottom: 44, left: 64 };

const getDate = (d: ChartPoint) => new Date(d.date);
const getActual = (d: ChartPoint) => d.actual ?? null;
const getPredicted = (d: ChartPoint) => d.predicted ?? null;
const getLower = (d: ChartPoint) => d.lower_bound ?? 0;
const getUpper = (d: ChartPoint) => d.upper_bound ?? 0;

const bisectDate = bisector<ChartPoint, Date>((d: ChartPoint) => new Date(d.date)).left;

export default function VisxForecastChart({
  chartData,
  simulationData,
  width = 900,
  height = 440,
  summary,
}: VisxForecastChartProps) {
  const {
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipLeft = 0,
    tooltipTop = 0,
    tooltipOpen,
  } = useTooltip<{ point: ChartPoint; sim?: SimulationPoint }>();

  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const historyPoints = useMemo(() => chartData.filter((d) => d.actual != null), [chartData]);
  const forecastPoints = useMemo(() => chartData.filter((d) => d.predicted != null), [chartData]);

  const simMap = useMemo(() => {
    if (!simulationData) return new Map<string, SimulationPoint>();
    return new Map(simulationData.map((s) => [s.date, s]));
  }, [simulationData]);

  const xScale = useMemo(() => {
    const dates = chartData.map(getDate);
    return scaleTime<number>({
      domain: [Math.min(...dates.map((d) => d.getTime())), Math.max(...dates.map((d) => d.getTime()))],
      range: [0, innerWidth],
    });
  }, [chartData, innerWidth]);

  const yScale = useMemo(() => {
    const allValues: number[] = [];
    chartData.forEach((d) => {
      if (d.actual != null) allValues.push(d.actual);
      if (d.predicted != null) allValues.push(d.predicted);
      if (d.upper_bound != null) allValues.push(d.upper_bound);
      if (d.lower_bound != null) allValues.push(d.lower_bound);
    });
    if (simulationData) {
      simulationData.forEach((s) => {
        allValues.push(s.mutated_predicted);
        allValues.push(s.baseline_predicted);
      });
    }
    const min = Math.min(...allValues) * 0.9;
    const max = Math.max(...allValues) * 1.12;
    return scaleLinear<number>({
      domain: [Math.max(0, min), max || 100],
      range: [innerHeight, 0],
      nice: true,
    });
  }, [chartData, simulationData, innerHeight]);

  const targetMetric = summary?.metadata?.target_metric || 'revenue';
  const isCurrency = /price|sales|revenue/i.test(targetMetric);

  const formatDynamic = useCallback(
    (val: number) => {
      if (isCurrency) return formatCurrency(val);
      return Number(val).toLocaleString('en-US');
    },
    [isCurrency]
  );

  const formatDynamicCompact = useCallback(
    (val: number) => {
      if (isCurrency) return formatCurrencyCompact(val);
      return Number(val).toLocaleString('en-US', { notation: 'compact' });
    },
    [isCurrency]
  );

  const historyLinePath = useMemo(() => {
    const lineGen = line<ChartPoint>()
      .x((d) => xScale(getDate(d)))
      .y((d) => yScale(getActual(d) ?? 0))
      .curve(curveMonotoneX);
    return lineGen(historyPoints) ?? '';
  }, [historyPoints, xScale, yScale]);

  const forecastLinePath = useMemo(() => {
    const lineGen = line<ChartPoint>()
      .x((d) => xScale(getDate(d)))
      .y((d) => yScale(getPredicted(d) ?? 0))
      .curve(curveMonotoneX);
    return lineGen(forecastPoints) ?? '';
  }, [forecastPoints, xScale, yScale]);

  const simulationLinePath = useMemo(() => {
    if (!simulationData || simulationData.length === 0) return '';
    const lineGen = line<SimulationPoint>()
      .x((d) => xScale(new Date(d.date)))
      .y((d) => yScale(d.mutated_predicted))
      .curve(curveMonotoneX);
    return lineGen(simulationData) ?? '';
  }, [simulationData, xScale, yScale]);

  const simPositive = (simulationData?.[0]?.delta ?? 0) >= 0;

  const handleTooltip = useCallback(
    (event: React.TouchEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>) => {
      const { x } = localPoint(event) || { x: 0 };
      const x0 = xScale.invert(x - MARGIN.left);
      const index = bisectDate(chartData, x0, 1);
      const d0 = chartData[index - 1];
      const d1 = chartData[index];
      let point = d0;
      if (d1 && getDate(d1)) {
        point =
          x0.getTime() - getDate(d0).getTime() > getDate(d1).getTime() - x0.getTime() ? d1 : d0;
      }
      if (!point) return;
      const sim = simMap.get(point.date);

      showTooltip({
        tooltipData: { point, sim },
        tooltipLeft: xScale(getDate(point)) + MARGIN.left,
        tooltipTop: yScale(getActual(point) ?? getPredicted(point) ?? 0) + MARGIN.top,
      });
    },
    [chartData, xScale, yScale, showTooltip, simMap]
  );

  if (innerWidth <= 0 || innerHeight <= 0) return null;

  return (
    <div className="relative w-full">
      <svg
        width={width}
        height={height}
        className="overflow-visible"
        role="img"
        aria-label="Forecast trajectory with confidence corridor"
      >
        <LinearGradient id="grad-confidence" from={CHART_COLORS.bandStrong} to={CHART_COLORS.band} />
        <LinearGradient id="grad-history" from="rgba(245, 243, 239, 0.07)" to="rgba(245, 243, 239, 0)" />
        <LinearGradient id="grad-sim-surplus" from="rgba(52, 211, 153, 0.22)" to="rgba(52, 211, 153, 0)" />
        <LinearGradient id="grad-sim-deficit" from="rgba(248, 113, 113, 0.22)" to="rgba(248, 113, 113, 0)" />

        <Group left={MARGIN.left} top={MARGIN.top}>
          {yScale.ticks(5).map((tick) => (
            <line
              key={`grid-${tick}`}
              x1={0}
              x2={innerWidth}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke={CHART_COLORS.grid}
            />
          ))}

          {forecastPoints.length > 0 && (
            <AreaClosed<ChartPoint>
              data={forecastPoints}
              x={(d) => xScale(getDate(d))}
              y0={(d) => yScale(getLower(d))}
              y1={(d) => yScale(getUpper(d))}
              yScale={yScale}
              curve={curveMonotoneX}
              fill="url(#grad-confidence)"
              strokeWidth={0}
            />
          )}

          {historyPoints.length > 0 && (
            <AreaClosed<ChartPoint>
              data={historyPoints}
              x={(d) => xScale(getDate(d))}
              y0={() => yScale(yScale.domain()[0])}
              y1={(d) => yScale(getActual(d) ?? 0)}
              yScale={yScale}
              curve={curveMonotoneX}
              fill="url(#grad-history)"
              strokeWidth={0}
            />
          )}

          {/* History — ink */}
          <motion.path
            d={historyLinePath}
            fill="none"
            stroke="rgba(245, 243, 239, 0.62)"
            strokeWidth={1.75}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          />

          {/* Forecast — the amber trace */}
          <motion.path
            d={forecastLinePath}
            fill="none"
            stroke={CHART_COLORS.trace}
            strokeWidth={2.25}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
          />

          {/* Simulated scenario */}
          {simulationData && simulationData.length > 0 && (
            <>
              <AreaClosed<SimulationPoint>
                data={simulationData}
                x={(d) => xScale(new Date(d.date))}
                y0={(d) => yScale(d.baseline_predicted)}
                y1={(d) => yScale(d.mutated_predicted)}
                yScale={yScale}
                curve={curveMonotoneX}
                fill={simPositive ? 'url(#grad-sim-surplus)' : 'url(#grad-sim-deficit)'}
                strokeWidth={0}
              />
              <motion.path
                d={simulationLinePath}
                fill="none"
                stroke={simPositive ? CHART_COLORS.positive : CHART_COLORS.negative}
                strokeWidth={2}
                strokeDasharray="5 3"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              />
            </>
          )}

          {tooltipOpen && tooltipData && (
            <>
              <line
                x1={xScale(new Date(tooltipData.point.date))}
                x2={xScale(new Date(tooltipData.point.date))}
                y1={0}
                y2={innerHeight}
                stroke={CHART_COLORS.crosshair}
                strokeWidth={1}
                strokeDasharray="3 3"
                pointerEvents="none"
              />
              <circle
                cx={xScale(new Date(tooltipData.point.date))}
                cy={yScale(getActual(tooltipData.point) ?? getPredicted(tooltipData.point) ?? 0)}
                r={4.5}
                fill={CHART_COLORS.surface}
                stroke={tooltipData.point.actual != null ? '#F5F3EF' : CHART_COLORS.trace}
                strokeWidth={2}
                pointerEvents="none"
              />
              {tooltipData.sim && (
                <circle
                  cx={xScale(new Date(tooltipData.sim.date))}
                  cy={yScale(tooltipData.sim.mutated_predicted)}
                  r={4.5}
                  fill={CHART_COLORS.surface}
                  stroke={tooltipData.sim.delta >= 0 ? CHART_COLORS.positive : CHART_COLORS.negative}
                  strokeWidth={2}
                  pointerEvents="none"
                />
              )}
            </>
          )}

          <AxisBottom
            scale={xScale}
            top={innerHeight}
            stroke={CHART_COLORS.gridStrong}
            tickStroke="transparent"
            numTicks={Math.min(8, Math.floor(innerWidth / 90))}
            tickLabelProps={() => ({
              ...axisTickProps,
              textAnchor: 'middle' as const,
              dy: 8,
            })}
            tickFormat={(date) => {
              const d = date as Date;
              return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
            }}
          />
          <AxisLeft
            scale={yScale}
            stroke="transparent"
            tickStroke="transparent"
            numTicks={5}
            tickLabelProps={() => ({
              ...axisTickProps,
              textAnchor: 'end' as const,
              dx: -8,
            })}
            tickFormat={(val) => formatDynamicCompact(val as number)}
          />

          <rect
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onMouseMove={handleTooltip}
            onMouseLeave={hideTooltip}
            onTouchMove={handleTooltip}
            onTouchEnd={hideTooltip}
          />
        </Group>
      </svg>

      {tooltipOpen && tooltipData && (
        <TooltipWithBounds left={tooltipLeft} top={tooltipTop} style={tooltipStyles}>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 border-b border-hairline pb-1">
              <span className="text-[10px] text-ink-secondary">
                {new Date(tooltipData.point.date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <span className="text-[10px] uppercase tracking-[0.1em] text-signal">
                {tooltipData.point.actual != null ? 'Historical' : 'Forecast'}
              </span>
            </div>

            {tooltipData.point.actual != null && (
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="text-ink-muted">Actual</span>
                <span className="font-mono font-semibold text-ink">
                  {formatDynamic(tooltipData.point.actual)}
                </span>
              </div>
            )}

            {tooltipData.point.predicted != null && (
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="text-signal">Projected</span>
                <span className="font-mono font-semibold text-ink">
                  {formatDynamic(tooltipData.point.predicted)}
                </span>
              </div>
            )}

            {tooltipData.sim && (
              <div className="space-y-1 border-t border-hairline pt-1.5">
                <div className="flex items-center justify-between gap-4 text-xs">
                  <span
                    className={
                      tooltipData.sim.delta >= 0 ? 'text-positive' : 'text-negative'
                    }
                  >
                    Mutated twin
                  </span>
                  <span className="font-mono font-semibold text-ink">
                    {formatDynamic(tooltipData.sim.mutated_predicted)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 text-[11px]">
                  <span className="text-ink-muted">Scenario shift</span>
                  <span
                    className={`font-mono font-semibold ${
                      tooltipData.sim.delta >= 0 ? 'text-positive' : 'text-negative'
                    }`}
                  >
                    {formatDelta(tooltipData.sim.delta)} ({formatDeltaPct(tooltipData.sim.delta_pct)})
                  </span>
                </div>
              </div>
            )}

            {tooltipData.point.lower_bound != null && tooltipData.point.upper_bound != null && (
              <div className="flex justify-between border-t border-hairline pt-1 font-mono text-[10px] text-ink-muted">
                <span>80% CI</span>
                <span>
                  {formatDynamicCompact(tooltipData.point.lower_bound)} –{' '}
                  {formatDynamicCompact(tooltipData.point.upper_bound)}
                </span>
              </div>
            )}
          </div>
        </TooltipWithBounds>
      )}

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
        {simulationData && (
          <div className="flex items-center gap-2">
            <span
              className={`h-[2px] w-4 rounded-full ${
                simPositive ? 'bg-positive' : 'bg-negative'
              }`}
            />
            <span className={simPositive ? 'text-positive' : 'text-negative'}>
              Simulated scenario
            </span>
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
