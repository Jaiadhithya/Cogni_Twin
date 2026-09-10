'use client';

import { useMemo, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Group } from '@visx/group';
import { LinePath, AreaClosed, line } from '@visx/shape';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { LinearGradient } from '@visx/gradient';
import { curveMonotoneX } from '@visx/curve';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { bisector } from 'd3-array';
import { formatCurrency, formatCurrencyCompact, formatDelta, formatDeltaPct } from '@/lib/formatters';

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

const MARGIN = { top: 30, right: 30, bottom: 50, left: 70 };

const tooltipStyles = {
  ...defaultStyles,
  backgroundColor: 'rgba(6, 9, 14, 0.96)',
  border: '1px solid rgba(0, 240, 255, 0.35)',
  borderRadius: '12px',
  padding: '14px 18px',
  color: '#FFFFFF',
  backdropFilter: 'blur(20px)',
  boxShadow: '0 20px 40px -10px rgba(0,0,0,0.85), 0 0 20px rgba(0,240,255,0.2)',
  fontFamily: 'var(--font-jetbrains-mono), monospace',
  lineHeight: '1.6',
};

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
  } = useTooltip<{
    point: ChartPoint;
    sim?: SimulationPoint;
  }>();

  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const historyPoints = useMemo(
    () => chartData.filter((d) => d.actual != null),
    [chartData]
  );
  const forecastPoints = useMemo(
    () => chartData.filter((d) => d.predicted != null),
    [chartData]
  );

  const simMap = useMemo(() => {
    if (!simulationData) return new Map<string, SimulationPoint>();
    return new Map(simulationData.map((s) => [s.date, s]));
  }, [simulationData]);

  const xScale = useMemo(() => {
    const dates = chartData.map(getDate);
    return scaleTime<number>({
      domain: [
        Math.min(...dates.map((d) => d.getTime())),
        Math.max(...dates.map((d) => d.getTime())),
      ],
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
          x0.getTime() - getDate(d0).getTime() > getDate(d1).getTime() - x0.getTime()
            ? d1
            : d0;
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
      <svg width={width} height={height} className="overflow-visible">
        <LinearGradient
          id="gradient-confidence-prophet"
          from="rgba(0, 240, 255, 0.22)"
          to="rgba(0, 240, 255, 0.0)"
        />
        <LinearGradient
          id="gradient-history-prophet"
          from="rgba(255, 255, 255, 0.08)"
          to="rgba(255, 255, 255, 0.0)"
        />
        <LinearGradient
          id="gradient-sim-surplus"
          from="rgba(0, 229, 153, 0.25)"
          to="rgba(0, 229, 153, 0.0)"
        />
        <LinearGradient
          id="gradient-sim-deficit"
          from="rgba(255, 68, 102, 0.25)"
          to="rgba(255, 68, 102, 0.0)"
        />

        <Group left={MARGIN.left} top={MARGIN.top}>
          {/* Grid lines */}
          {yScale.ticks(5).map((tick) => (
            <line
              key={`grid-${tick}`}
              x1={0}
              x2={innerWidth}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke="rgba(255, 255, 255, 0.05)"
              strokeDasharray="3 3"
            />
          ))}

          {/* Confidence Interval Ribbon */}
          {forecastPoints.length > 0 && (
            <AreaClosed<ChartPoint>
              data={forecastPoints}
              x={(d) => xScale(getDate(d))}
              y0={(d) => yScale(getLower(d))}
              y1={(d) => yScale(getUpper(d))}
              yScale={yScale}
              curve={curveMonotoneX}
              fill="url(#gradient-confidence-prophet)"
              strokeWidth={0}
            />
          )}

          {/* History Area Fill */}
          {historyPoints.length > 0 && (
            <AreaClosed<ChartPoint>
              data={historyPoints}
              x={(d) => xScale(getDate(d))}
              y0={() => yScale(yScale.domain()[0])}
              y1={(d) => yScale(getActual(d) ?? 0)}
              yScale={yScale}
              curve={curveMonotoneX}
              fill="url(#gradient-history-prophet)"
              strokeWidth={0}
            />
          )}

          {/* History Line (White/Slate) */}
          <motion.path
            d={historyLinePath}
            fill="none"
            stroke="rgba(255, 255, 255, 0.55)"
            strokeWidth={2}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
          />

          {/* Forecast Baseline (Spectral Cyan) */}
          <motion.path
            d={forecastLinePath}
            fill="none"
            stroke="#00F0FF"
            strokeWidth={2.5}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.4, ease: 'easeInOut' }}
            style={{ filter: 'drop-shadow(0 0 8px rgba(0,240,255,0.6))' }}
          />

          {/* Simulation Mutated Line (Cadmium Amber / Radiant Emerald) */}
          {simulationData && simulationData.length > 0 && (
            <>
              <AreaClosed<SimulationPoint>
                data={simulationData}
                x={(d) => xScale(new Date(d.date))}
                y0={(d) => yScale(d.baseline_predicted)}
                y1={(d) => yScale(d.mutated_predicted)}
                yScale={yScale}
                curve={curveMonotoneX}
                fill={
                  simulationData[0].delta >= 0
                    ? 'url(#gradient-sim-surplus)'
                    : 'url(#gradient-sim-deficit)'
                }
                strokeWidth={0}
              />
              <motion.path
                d={simulationLinePath}
                fill="none"
                stroke={simulationData[0].delta >= 0 ? '#00E599' : '#FFB020'}
                strokeWidth={2.5}
                strokeDasharray="6 3"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: 'easeInOut' }}
                style={{
                  filter: `drop-shadow(0 0 10px ${
                    simulationData[0].delta >= 0 ? '#00E599' : '#FFB020'
                  })`,
                }}
              />
            </>
          )}

          {/* Dual-Axis Crosshairs */}
          {tooltipOpen && tooltipData && (
            <>
              <line
                x1={xScale(new Date(tooltipData.point.date))}
                x2={xScale(new Date(tooltipData.point.date))}
                y1={0}
                y2={innerHeight}
                stroke="rgba(0, 240, 255, 0.45)"
                strokeWidth={1}
                strokeDasharray="4 4"
                pointerEvents="none"
              />
              <line
                x1={0}
                x2={innerWidth}
                y1={yScale(
                  getActual(tooltipData.point) ?? getPredicted(tooltipData.point) ?? 0
                )}
                y2={yScale(
                  getActual(tooltipData.point) ?? getPredicted(tooltipData.point) ?? 0
                )}
                stroke="rgba(0, 240, 255, 0.3)"
                strokeWidth={1}
                strokeDasharray="4 4"
                pointerEvents="none"
              />
              <circle
                cx={xScale(new Date(tooltipData.point.date))}
                cy={yScale(
                  getActual(tooltipData.point) ?? getPredicted(tooltipData.point) ?? 0
                )}
                r={6}
                fill="#030507"
                stroke={tooltipData.point.actual != null ? '#FFFFFF' : '#00F0FF'}
                strokeWidth={2.5}
                pointerEvents="none"
              />
              {tooltipData.sim && (
                <circle
                  cx={xScale(new Date(tooltipData.sim.date))}
                  cy={yScale(tooltipData.sim.mutated_predicted)}
                  r={6}
                  fill="#030507"
                  stroke={tooltipData.sim.delta >= 0 ? '#00E599' : '#FF4466'}
                  strokeWidth={2.5}
                  pointerEvents="none"
                />
              )}
            </>
          )}

          {/* X & Y Axes */}
          <AxisBottom
            scale={xScale}
            top={innerHeight}
            stroke="rgba(255, 255, 255, 0.08)"
            tickStroke="transparent"
            numTicks={Math.min(8, Math.floor(innerWidth / 90))}
            tickLabelProps={() => ({
              fill: 'rgba(255, 255, 255, 0.4)',
              fontSize: 10,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
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
              fill: 'rgba(255, 255, 255, 0.4)',
              fontSize: 10,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              textAnchor: 'end' as const,
              dx: -8,
            })}
            tickFormat={(val) => formatDynamicCompact(val as number)}
          />

          {/* Hover Capture Surface */}
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

      {/* Floating Rich Tooltip */}
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          left={tooltipLeft}
          top={tooltipTop}
          style={tooltipStyles}
        >
          <div className="space-y-2 font-mono">
            <div className="text-[10px] uppercase tracking-widest text-white/40 pb-1 border-b border-white/10 flex items-center justify-between gap-3">
              <span>
                {new Date(tooltipData.point.date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <span className="text-[#00F0FF]">
                {tooltipData.point.actual != null ? 'HISTORICAL' : 'PROPHET MODEL'}
              </span>
            </div>

            {tooltipData.point.actual != null && (
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="text-white/60">Actual Flow:</span>
                <span className="font-bold text-white">
                  {formatDynamic(tooltipData.point.actual)}
                </span>
              </div>
            )}

            {tooltipData.point.predicted != null && (
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="text-[#00F0FF]">Baseline Projection:</span>
                <span className="font-bold text-white">
                  {formatDynamic(tooltipData.point.predicted)}
                </span>
              </div>
            )}

            {tooltipData.sim && (
              <div className="pt-1.5 border-t border-white/10 space-y-1">
                <div className="flex items-center justify-between gap-4 text-xs">
                  <span className={tooltipData.sim.delta >= 0 ? 'text-[#00E599]' : 'text-[#FF4466]'}>
                    Mutated Twin:
                  </span>
                  <span className="font-bold text-white">
                    {formatDynamic(tooltipData.sim.mutated_predicted)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 text-[11px]">
                  <span className="text-white/40">Scenario Shift:</span>
                  <span
                    className={`font-bold ${
                      tooltipData.sim.delta >= 0 ? 'text-[#00E599]' : 'text-[#FF4466]'
                    }`}
                  >
                    {formatDelta(tooltipData.sim.delta)} ({formatDeltaPct(tooltipData.sim.delta_pct)})
                  </span>
                </div>
              </div>
            )}

            {tooltipData.point.lower_bound != null && tooltipData.point.upper_bound != null && (
              <div className="text-[9px] text-white/40 pt-1 border-t border-white/5 flex justify-between">
                <span>80% CI Range:</span>
                <span>
                  {formatDynamicCompact(tooltipData.point.lower_bound)} -{' '}
                  {formatDynamicCompact(tooltipData.point.upper_bound)}
                </span>
              </div>
            )}
          </div>
        </TooltipWithBounds>
      )}

      {/* Legend Strip */}
      <div className="flex flex-wrap items-center justify-center gap-6 mt-4 text-xs font-mono text-white/50">
        <div className="flex items-center gap-2">
          <span className="w-4 h-[2px] bg-white/70 rounded-full" />
          <span>Historical Signal</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-[2px] bg-[#00F0FF] rounded-full shadow-[0_0_8px_#00F0FF]" />
          <span className="text-[#00F0FF] font-medium">90-Day Prophet Baseline</span>
        </div>
        {simulationData && (
          <div className="flex items-center gap-2">
            <span
              className={`w-4 h-[2px] rounded-full shadow-md ${
                (simulationData[0]?.delta ?? 0) >= 0 ? 'bg-[#00E599]' : 'bg-[#FFB020]'
              }`}
            />
            <span className={(simulationData[0]?.delta ?? 0) >= 0 ? 'text-[#00E599]' : 'text-[#FFB020]'}>
              Simulated Scenario
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="w-4 h-3 bg-[#00F0FF]/20 border border-[#00F0FF]/40 rounded-sm" />
          <span>Confidence Envelope</span>
        </div>
      </div>
    </div>
  );
}
