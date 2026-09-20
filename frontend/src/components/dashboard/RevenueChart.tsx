'use client';

import React, { useMemo, useCallback, useState } from 'react';
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
import { ParentSize } from '@visx/responsive';
import { formatCurrency, formatCurrencyCompact } from '@/lib/formatters';
import { Calendar } from 'lucide-react';
import { CHART_COLORS, tooltipStyles, tooltipValueStyles, axisTickProps } from '@/lib/chartTheme';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';

interface ChartPoint {
  date: string;
  [key: string]: any;
}

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
  const margin = { top: 16, right: 24, bottom: 36, left: 60 };
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
    [data, xScale, yScale, showTooltip]
  );

  if (innerWidth <= 0 || innerHeight <= 0) return null;

  const numTicks = Math.min(8, Math.floor(innerWidth / 90));
  const tickInterval = Math.max(1, Math.floor(data.length / numTicks));
  const explicitTicks = data
    .filter((_, index) => index % tickInterval === 0)
    .map((d) => new Date(d.date));

  return (
    <div className="relative">
      <svg width={width} height={height} role="img" aria-label={`${metricName} trajectory chart`}>
        <LinearGradient id="traceArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CHART_COLORS.trace} stopOpacity={0.22} />
          <stop offset="60%" stopColor={CHART_COLORS.trace} stopOpacity={0.05} />
          <stop offset="100%" stopColor={CHART_COLORS.trace} stopOpacity={0} />
        </LinearGradient>

        <Group left={margin.left} top={margin.top}>
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

          <AreaClosed<ChartPoint>
            data={data}
            x={(d) => xScale(new Date(d.date))}
            y0={innerHeight}
            y1={(d) => yScale(Number(d[yKey]) || 0)}
            yScale={yScale}
            curve={curveMonotoneX}
            fill="url(#traceArea)"
            strokeWidth={0}
          />

          {/* The amber trace */}
          <motion.path
            d={linePath}
            fill="none"
            stroke={CHART_COLORS.trace}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          />

          {tooltipOpen && tooltipData && (
            <>
              <line
                x1={xScale(new Date(tooltipData.date))}
                x2={xScale(new Date(tooltipData.date))}
                y1={0}
                y2={innerHeight}
                stroke={CHART_COLORS.crosshair}
                strokeWidth={1}
                strokeDasharray="3 3"
                pointerEvents="none"
              />
              <circle
                cx={xScale(new Date(tooltipData.date))}
                cy={yScale(Number(tooltipData[yKey]) || 0)}
                r={4.5}
                fill={CHART_COLORS.surface}
                stroke={CHART_COLORS.trace}
                strokeWidth={2}
                pointerEvents="none"
              />
            </>
          )}

          <AxisBottom
            scale={xScale}
            top={innerHeight}
            stroke={CHART_COLORS.gridStrong}
            tickStroke="transparent"
            tickValues={explicitTicks}
            tickLabelProps={() => ({
              ...axisTickProps,
              textAnchor: 'middle',
              dy: 10,
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
              textAnchor: 'end',
              dx: -8,
            })}
            tickFormat={(val) => formatDynamicCompact(Number(val))}
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
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-[0.1em] text-ink-muted">
              {metricName}
            </div>
            <div style={tooltipValueStyles}>{formatDynamic(Number(tooltipData[yKey] || 0))}</div>
            <div className="border-t border-hairline pt-1 font-mono text-[10px] text-ink-secondary">
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
    <div className="flex h-full flex-col justify-between overflow-hidden p-6">
      <div className="relative z-10 mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-h2 capitalize text-ink">
            {metricName ? metricName.replace(/_/g, ' ') : 'Operational'} trajectory
          </h3>
          <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
            Time-series telemetry with automated seasonal smoothing
          </p>
        </div>

        <SegmentedTabs
          layoutId="horizon-tabs"
          size="sm"
          value={horizon}
          onChange={setHorizon}
          tabs={[
            { value: '30', label: '30D' },
            { value: '60', label: '60D' },
            { value: '90', label: '90D' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>

      <div className="panel-inset relative z-10 mb-4 grid grid-cols-3 gap-3 p-3">
        <div>
          <span className="text-caption block">Current</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-ink">
            {formatCurrency(stats.latest)}
          </span>
        </div>
        <div className="border-l border-hairline pl-3">
          <span className="text-caption block">Period average</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-ink">
            {formatCurrency(stats.avg)}
          </span>
        </div>
        <div className="border-l border-hairline pl-3">
          <span className="text-caption block">Cycle peak</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-signal">
            {formatCurrency(stats.peak)}
          </span>
        </div>
      </div>

      <div className="relative z-10 h-[320px] w-full min-w-0 max-w-full flex-grow overflow-hidden">
        {!filteredData || filteredData.length === 0 ? (
          <div className="panel-inset flex h-full w-full flex-col items-center justify-center p-6 text-center">
            <Calendar className="mb-3 h-7 w-7 text-ink-muted" strokeWidth={1.5} />
            <span className="text-sm font-medium text-ink">No telemetry ingested</span>
            <span className="mt-1 max-w-xs text-xs text-ink-muted">
              Upload a dataset or select an active twin to generate time-series curves.
            </span>
          </div>
        ) : (
          <ParentSize debounceTime={10}>
            {({ width, height }) =>
              width > 0 && height > 0 ? (
                <RevenueChartInner
                  data={filteredData}
                  width={width}
                  height={height}
                  yKey={yKey}
                  metricName={metricName}
                />
              ) : null
            }
          </ParentSize>
        )}
      </div>
    </div>
  );
}
