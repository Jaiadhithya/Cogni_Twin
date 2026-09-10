'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Group } from '@visx/group';
import { AreaClosed, line } from '@visx/shape';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { LinearGradient } from '@visx/gradient';
import { curveMonotoneX } from '@visx/curve';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { bisector } from 'd3-array';
import { ParentSize } from '@visx/responsive';
import { formatCurrency, formatCurrencyCompact } from '@/lib/formatters';
import { TrendingUp, ArrowUpRight, Calendar } from 'lucide-react';

const ACCENT = '#00F0FF';
const ACCENT_EMERALD = '#00E599';

interface ChartPoint {
  date: string;
  [key: string]: any;
}

const tooltipStyles = {
  ...defaultStyles,
  backgroundColor: 'rgba(6, 9, 14, 0.95)',
  borderColor: 'rgba(0, 240, 255, 0.3)',
  borderRadius: '12px',
  borderWidth: '1px',
  backdropFilter: 'blur(20px)',
  boxShadow: '0 20px 40px -10px rgba(0,0,0,0.8), 0 0 20px rgba(0,240,255,0.2)',
  color: '#FFFFFF',
  padding: '12px 16px',
  fontFamily: 'var(--font-jetbrains-mono), monospace',
};

const bisectDate = bisector<ChartPoint, Date>((d) => new Date(d.date)).left;

function RevenueChartInner({
  data,
  width,
  height,
  yKey,
  metricName,
}: {
  data: ChartPoint[];
  width: number;
  height: number;
  yKey: string;
  metricName: string;
}) {
  const margin = { top: 20, right: 30, bottom: 40, left: 65 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const {
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipLeft = 0,
    tooltipTop = 0,
    tooltipOpen,
  } = useTooltip<ChartPoint>();

  const isCurrency = /revenue|price|sales|cost|flow/i.test(metricName);

  const formatDynamic = useCallback((val: number) => {
    if (isCurrency) return formatCurrency(val);
    return Number(val).toLocaleString('en-US');
  }, [isCurrency]);

  const formatDynamicCompact = useCallback((val: number) => {
    if (isCurrency) return formatCurrencyCompact(val);
    return Number(val).toLocaleString('en-US', { notation: 'compact' });
  }, [isCurrency]);

  const xScale = useMemo(() => {
    return scaleTime<number>({
      domain: [
        Math.min(...data.map((d) => new Date(d.date).getTime())),
        Math.max(...data.map((d) => new Date(d.date).getTime())),
      ],
      range: [0, innerWidth],
    });
  }, [data, innerWidth]);

  const yScale = useMemo(() => {
    const values = data.map((d) => Number(d[yKey]) || 0);
    const max = Math.max(...values, 1);
    return scaleLinear<number>({
      domain: [0, max * 1.12],
      range: [innerHeight, 0],
      nice: true,
    });
  }, [data, innerHeight, yKey]);

  const linePath = useMemo(() => {
    const lineGen = line<ChartPoint>()
      .x((d) => xScale(new Date(d.date)))
      .y((d) => yScale(Number(d[yKey]) || 0))
      .curve(curveMonotoneX);
    return lineGen(data) || '';
  }, [data, xScale, yScale]);

  const handleTooltip = useCallback(
    (event: React.TouchEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>) => {
      const { x } = localPoint(event) || { x: 0 };
      const x0 = xScale.invert(x - margin.left);
      const index = bisectDate(data, x0, 1);
      const d0 = data[index - 1];
      const d1 = data[index];
      let point = d0;
      if (d1 && d1.date) {
        point =
          x0.getTime() - new Date(d0.date).getTime() > new Date(d1.date).getTime() - x0.getTime()
            ? d1
            : d0;
      }

      showTooltip({
        tooltipData: point,
        tooltipLeft: xScale(new Date(point.date)) + margin.left,
        tooltipTop: yScale(Number(point[yKey]) || 0) + margin.top,
      });
    },
    [data, xScale, yScale, showTooltip, margin]
  );

  if (innerWidth <= 0 || innerHeight <= 0) return null;

  const numTicks = Math.min(8, Math.floor(innerWidth / 90));
  const tickInterval = Math.max(1, Math.floor(data.length / numTicks));
  const explicitTicks = data
    .filter((_, index) => index % tickInterval === 0)
    .map((d) => new Date(d.date));

  return (
    <div className="relative">
      <svg width={width} height={height}>
        <LinearGradient id="colorRevenueGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
          <stop offset="60%" stopColor={ACCENT_EMERALD} stopOpacity={0.08} />
          <stop offset="100%" stopColor="#030507" stopOpacity={0} />
        </LinearGradient>

        <Group left={margin.left} top={margin.top}>
          {/* Subtle Grid lines */}
          {yScale.ticks(5).map((tick) => (
            <line
              key={`grid-${tick}`}
              x1={0}
              x2={innerWidth}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="3 3"
            />
          ))}

          {/* Area Fill */}
          <AreaClosed<ChartPoint>
            data={data}
            x={(d) => xScale(new Date(d.date))}
            y0={innerHeight}
            y1={(d) => yScale(Number(d[yKey]) || 0)}
            yScale={yScale}
            curve={curveMonotoneX}
            fill="url(#colorRevenueGlow)"
            strokeWidth={0}
          />

          {/* Smooth Line */}
          <motion.path
            d={linePath}
            fill="none"
            stroke={ACCENT}
            strokeWidth={2.5}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.4, ease: 'easeInOut' }}
          />

          {/* Tooltip Crosshair & Target Dot */}
          {tooltipOpen && tooltipData && (
            <>
              {/* Vertical Crosshair */}
              <line
                x1={xScale(new Date(tooltipData.date))}
                x2={xScale(new Date(tooltipData.date))}
                y1={0}
                y2={innerHeight}
                stroke="rgba(0, 240, 255, 0.4)"
                strokeWidth={1}
                strokeDasharray="4 4"
                pointerEvents="none"
              />
              {/* Horizontal Crosshair */}
              <line
                x1={0}
                x2={innerWidth}
                y1={yScale(Number(tooltipData[yKey]) || 0)}
                y2={yScale(Number(tooltipData[yKey]) || 0)}
                stroke="rgba(0, 240, 255, 0.25)"
                strokeWidth={1}
                strokeDasharray="4 4"
                pointerEvents="none"
              />
              <circle
                cx={xScale(new Date(tooltipData.date))}
                cy={yScale(Number(tooltipData[yKey]) || 0)}
                r={6}
                fill="#030507"
                stroke={ACCENT}
                strokeWidth={2.5}
                pointerEvents="none"
              />
              <circle
                cx={xScale(new Date(tooltipData.date))}
                cy={yScale(Number(tooltipData[yKey]) || 0)}
                r={2}
                fill="#FFFFFF"
                pointerEvents="none"
              />
            </>
          )}

          {/* X Axis */}
          <AxisBottom
            scale={xScale}
            top={innerHeight}
            stroke="rgba(255,255,255,0.08)"
            tickStroke="transparent"
            tickValues={explicitTicks}
            tickLabelProps={() => ({
              fill: 'rgba(255,255,255,0.4)',
              fontSize: 10,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              textAnchor: 'middle',
              dy: 10,
            })}
            tickFormat={(date) => {
              const d = date as Date;
              return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
            }}
          />

          {/* Y Axis */}
          <AxisLeft
            scale={yScale}
            stroke="transparent"
            tickStroke="transparent"
            numTicks={5}
            tickLabelProps={() => ({
              fill: 'rgba(255,255,255,0.4)',
              fontSize: 10,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              textAnchor: 'end',
              dx: -10,
            })}
            tickFormat={(val) => formatDynamicCompact(Number(val))}
          />

          {/* Interaction Rectangle */}
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

      {/* Visx Tooltip Card */}
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds left={tooltipLeft} top={tooltipTop} style={tooltipStyles}>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] uppercase tracking-wider text-white/40">
                {metricName.toUpperCase()}
              </span>
              <span className="text-[10px] text-[#00E599] font-mono">NOMINAL</span>
            </div>
            <div className="text-base font-bold text-[#00F0FF] tabular-nums font-mono">
              {formatDynamic(Number(tooltipData[yKey] || 0))}
            </div>
            <div className="text-[11px] text-white/50 border-t border-white/10 pt-1 mt-1 font-mono">
              {new Date(tooltipData.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
}

export default function RevenueChart({
  data,
  yKey = 'value',
  metricName = 'Revenue',
}: {
  data: any[];
  yKey?: string;
  metricName?: string;
}) {
  const [horizon, setHorizon] = useState<'30' | '60' | '90' | 'all'>('all');

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (horizon === 'all') return data;
    const count = parseInt(horizon, 10);
    return data.slice(-count);
  }, [data, horizon]);

  const stats = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return { peak: 0, avg: 0, latest: 0 };
    const values = filteredData.map((d) => Number(d[yKey]) || 0);
    const peak = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const latest = values[values.length - 1];
    return { peak, avg, latest };
  }, [filteredData, yKey]);

  return (
    <div className="relative p-6 h-full flex flex-col justify-between overflow-hidden">
      
      {/* Header & Controls */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#00F0FF] shadow-[0_0_8px_#00F0FF]" />
            <h3 className="font-display text-lg font-semibold tracking-wide text-white capitalize">
              {metricName ? metricName.replace(/_/g, ' ') : 'Operational'} Trajectory
            </h3>
          </div>
          <p className="text-[11px] font-mono text-white/50">
            Time-series telemetry with automated seasonal smoothing
          </p>
        </div>

        {/* Horizon Filter Tabs & Stats Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 rounded-full bg-white/[0.04] border border-white/10 font-mono text-[11px]">
            {(['30', '60', '90', 'all'] as const).map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`px-3 py-1 rounded-full uppercase tracking-wider transition-colors cursor-pointer ${
                  horizon === h
                    ? 'bg-[#00F0FF] text-[#030507] font-bold shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {h === 'all' ? 'All Data' : `${h}D`}
              </button>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00E599]/10 border border-[#00E599]/25 text-[#00E599] font-mono text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E599] animate-pulse" />
            <span>REAL-TIME TELEMETRY</span>
          </div>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="relative z-10 grid grid-cols-3 gap-3 mb-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] font-mono">
        <div>
          <span className="text-[10px] text-white/40 uppercase tracking-wider block">CURRENT VALUE</span>
          <span className="text-sm sm:text-base font-bold text-white tabular-nums">
            {formatCurrency(stats.latest)}
          </span>
        </div>
        <div className="border-l border-white/10 pl-3">
          <span className="text-[10px] text-white/40 uppercase tracking-wider block">PERIOD AVERAGE</span>
          <span className="text-sm sm:text-base font-bold text-[#00F0FF] tabular-nums">
            {formatCurrency(stats.avg)}
          </span>
        </div>
        <div className="border-l border-white/10 pl-3">
          <span className="text-[10px] text-white/40 uppercase tracking-wider block">CYCLE PEAK</span>
          <span className="text-sm sm:text-base font-bold text-[#00E599] tabular-nums">
            {formatCurrency(stats.peak)}
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-[340px] w-full flex-grow relative z-10">
        <ParentSize debounceTime={10}>
          {({ width, height }) => (
            <RevenueChartInner
              data={filteredData}
              width={width}
              height={height}
              yKey={yKey}
              metricName={metricName}
            />
          )}
        </ParentSize>
      </div>

    </div>
  );
}
