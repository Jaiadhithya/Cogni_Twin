'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { useTooltip, TooltipWithBounds } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { ParentSize } from '@visx/responsive';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';
import { formatCurrency, formatCurrencyCompact } from '@/lib/formatters';
import {
  CHART_COLORS,
  SERIES_PALETTE,
  tooltipStyles,
  tooltipValueStyles,
  axisTickProps,
} from '@/lib/chartTheme';
import { cn } from '@/lib/utils';

interface DataPoint {
  [key: string]: any;
}

function CategoricalChartInner({
  data,
  width,
  height,
  categoryKey,
  valueKey,
  metricName,
}: {
  data: DataPoint[];
  width: number;
  height: number;
  categoryKey: string;
  valueKey: string;
  metricName?: string;
}) {
  const margin = { top: 16, right: 16, bottom: 48, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const {
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipLeft = 0,
    tooltipTop = 0,
    tooltipOpen,
  } = useTooltip<DataPoint>();

  const isCurrency = /revenue|price|sales|cost|flow/i.test(metricName || '');

  const formatDynamic = (val: number) => {
    if (isCurrency) return formatCurrency(val);
    return Number(val).toLocaleString('en-US');
  };

  const formatDynamicCompact = (val: number) => {
    if (isCurrency) return formatCurrencyCompact(val);
    return Number(val).toLocaleString('en-US', { notation: 'compact' });
  };

  const xScale = useMemo(
    () =>
      scaleBand<string>({
        range: [0, innerWidth],
        round: true,
        domain: data.map((d) => String(d[categoryKey] || 'Unknown')),
        padding: 0.35,
      }),
    [innerWidth, data, categoryKey]
  );

  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        range: [innerHeight, 0],
        round: true,
        domain: [0, Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1) * 1.15],
      }),
    [innerHeight, data, valueKey]
  );

  if (innerWidth <= 0 || innerHeight <= 0) return null;

  return (
    <div className="relative h-full w-full">
      <svg width={width} height={height} role="img" aria-label="Categorical distribution chart">
        <Group left={margin.left} top={margin.top}>
          {yScale.ticks(4).map((tick) => (
            <line
              key={`grid-${tick}`}
              x1={0}
              x2={innerWidth}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke={CHART_COLORS.grid}
            />
          ))}

          {data.map((d, index) => {
            const category = String(d[categoryKey] || 'Unknown');
            const value = Number(d[valueKey]) || 0;
            const barWidth = xScale.bandwidth();
            const barHeight = Math.max(0, innerHeight - yScale(value));
            const barX = xScale(category) || 0;
            const barY = yScale(value);
            const color = SERIES_PALETTE[index % SERIES_PALETTE.length];

            return (
              <Group key={`bar-${category}-${index}`}>
                <motion.rect
                  x={barX}
                  width={barWidth}
                  fill={color}
                  fillOpacity={0.16}
                  rx={3}
                  initial={{ y: innerHeight, height: 0 }}
                  animate={{ y: barY, height: barHeight }}
                  transition={{ duration: 0.5, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  onMouseMove={(event) => {
                    const coords = localPoint(event) || { x: 0, y: 0 };
                    showTooltip({
                      tooltipData: d,
                      tooltipLeft: coords.x + margin.left,
                      tooltipTop: coords.y + margin.top,
                    });
                  }}
                  onMouseLeave={hideTooltip}
                  className="cursor-pointer transition-[fill-opacity] duration-[var(--dur-base)] hover:fill-opacity-30"
                />
                <motion.rect
                  x={barX}
                  width={barWidth}
                  height={3}
                  y={barY}
                  fill={color}
                  rx={1.5}
                  initial={{ y: innerHeight }}
                  animate={{ y: barY }}
                  transition={{ duration: 0.5, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  style={{ pointerEvents: 'none' }}
                />
              </Group>
            );
          })}

          <AxisBottom
            scale={xScale}
            top={innerHeight}
            stroke={CHART_COLORS.gridStrong}
            tickStroke="transparent"
            tickLabelProps={() => ({
              ...axisTickProps,
              textAnchor: 'end',
              angle: -25,
              dy: 6,
              dx: -4,
            })}
          />

          <AxisLeft
            scale={yScale}
            stroke="transparent"
            tickStroke="transparent"
            numTicks={4}
            tickLabelProps={() => ({
              ...axisTickProps,
              textAnchor: 'end',
              dx: -8,
            })}
            tickFormat={(val) => formatDynamicCompact(Number(val))}
          />
        </Group>
      </svg>

      {tooltipOpen && tooltipData && (
        <TooltipWithBounds left={tooltipLeft} top={tooltipTop} style={tooltipStyles}>
          <div className="space-y-1">
            <span className="block text-xs font-semibold text-ink">
              {tooltipData[categoryKey]}
            </span>
            <div style={tooltipValueStyles}>{formatDynamic(Number(tooltipData[valueKey]))}</div>
            {tooltipData.share !== undefined && (
              <div className="border-t border-hairline pt-1 font-mono text-[10px] text-ink-secondary">
                Share: {tooltipData.share}% of total volume
              </div>
            )}
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
}

function CategoricalDonutView({
  data,
  categoryKey,
  valueKey,
  metricName,
  formatDynamic,
}: {
  data: DataPoint[];
  categoryKey: string;
  valueKey: string;
  metricName?: string;
  formatDynamic: (val: number) => string;
}) {
  const totalVal = useMemo(() => {
    return data.reduce((sum, d) => sum + (Number(d[valueKey]) || 0), 0);
  }, [data, valueKey]);

  const topCategory = useMemo(() => {
    if (!data.length) return null;
    return [...data].sort((a, b) => (Number(b[valueKey]) || 0) - (Number(a[valueKey]) || 0))[0];
  }, [data, valueKey]);

  const chartData = useMemo(() => {
    return data.map((d, i) => {
      const val = Number(d[valueKey]) || 0;
      const pct = totalVal > 0 ? (val / totalVal) * 100 : 0;
      return {
        ...d,
        name: String(d[categoryKey] || 'Unknown'),
        value: val,
        sharePct: pct,
        color: SERIES_PALETTE[i % SERIES_PALETTE.length],
      };
    });
  }, [data, categoryKey, valueKey, totalVal]);

  return (
    <div className="grid h-full grid-cols-1 items-center gap-4 p-2 md:grid-cols-12">
      <div className="relative flex h-[280px] items-center justify-center md:col-span-6">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <RechartsTooltip
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const entry = payload[0].payload;
                return (
                  <div style={tooltipStyles}>
                    <span className="mb-1 block text-xs font-semibold text-ink">{entry.name}</span>
                    <div style={tooltipValueStyles}>{formatDynamic(entry.value)}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-ink-secondary">
                      {entry.sharePct.toFixed(1)}% of total volume
                    </div>
                  </div>
                );
              }}
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={105}
              paddingAngle={2}
              stroke={CHART_COLORS.surface}
              strokeWidth={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-caption">Total {metricName?.toLowerCase() || 'volume'}</span>
          <span className="font-mono text-base font-semibold tabular-nums text-ink">
            {formatDynamic(totalVal)}
          </span>
          {topCategory && (
            <span className="mt-0.5 font-mono text-[10px] text-signal">
              Top: {String(topCategory[categoryKey])}
            </span>
          )}
        </div>
      </div>

      <div className="max-h-[290px] space-y-1.5 overflow-y-auto pr-1 md:col-span-6">
        {chartData.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between rounded-[var(--r-sm)] border border-hairline bg-graphite-900/50 p-2.5 transition-colors duration-[var(--dur-fast)] hover:bg-graphite-750"
          >
            <div className="flex min-w-0 items-center gap-2.5 pr-2">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="truncate text-xs font-medium text-ink">{item.name}</span>
            </div>
            <div className="flex flex-shrink-0 items-center gap-3">
              <span className="font-mono text-xs font-semibold tabular-nums text-ink">
                {formatDynamic(item.value)}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-ink-muted">
                {item.sharePct.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoricalHorizontalView({
  data,
  categoryKey,
  valueKey,
  formatDynamic,
}: {
  data: DataPoint[];
  categoryKey: string;
  valueKey: string;
  metricName?: string;
  formatDynamic: (val: number) => string;
}) {
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => (Number(b[valueKey]) || 0) - (Number(a[valueKey]) || 0));
  }, [data, valueKey]);

  const maxVal = useMemo(() => {
    return Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  }, [data, valueKey]);

  const totalVal = useMemo(() => {
    return data.reduce((sum, d) => sum + (Number(d[valueKey]) || 0), 0);
  }, [data, valueKey]);

  return (
    <div className="max-h-[320px] space-y-2.5 overflow-y-auto p-1 pr-1">
      {sortedData.map((item, index) => {
        const val = Number(item[valueKey]) || 0;
        const pctOfMax = (val / maxVal) * 100;
        const sharePct = totalVal > 0 ? ((val / totalVal) * 100).toFixed(1) : '0.0';
        const color = SERIES_PALETTE[index % SERIES_PALETTE.length];

        return (
          <div
            key={index}
            className="space-y-2 rounded-[var(--r-md)] border border-hairline bg-graphite-900/50 p-3 transition-colors duration-[var(--dur-fast)] hover:border-hairline-strong"
          >
            <div className="flex items-center justify-between text-xs">
              <div className="flex min-w-0 items-center gap-2.5 pr-2">
                <span className="font-mono text-[10px] font-semibold tabular-nums text-ink-muted">
                  #{index + 1}
                </span>
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span className="truncate font-medium text-ink">
                  {String(item[categoryKey] || 'Unknown')}
                </span>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2.5">
                <span className="font-mono font-semibold tabular-nums text-ink">
                  {formatDynamic(val)}
                </span>
                <span
                  className={cn(
                    'font-mono text-[10px] tabular-nums',
                    index === 0 ? 'text-signal' : 'text-ink-muted'
                  )}
                >
                  {sharePct}%
                </span>
              </div>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-[var(--r-pill)] bg-graphite-800">
              <motion.div
                className="h-full rounded-[var(--r-pill)]"
                style={{ backgroundColor: color }}
                initial={{ width: 0 }}
                animate={{ width: `${pctOfMax}%` }}
                transition={{ duration: 0.55, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CategoricalChart({
  data,
  categoryKey = 'category',
  valueKey = 'value',
  metricName = 'Revenue',
  viewMode = 'bar',
}: {
  data: any[];
  categoryKey?: string;
  valueKey?: string;
  metricName?: string;
  viewMode?: 'bar' | 'donut' | 'horizontal';
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[320px] w-full items-center justify-center py-12 text-sm text-ink-muted">
        No dimensional records available.
      </div>
    );
  }

  const isCurrency = /revenue|price|sales|cost|flow/i.test(metricName || '');
  const formatDynamic = (val: number) => {
    if (isCurrency) return formatCurrency(val);
    return Number(val).toLocaleString('en-US');
  };

  if (viewMode === 'donut') {
    return (
      <div className="relative z-10 min-h-[320px] w-full">
        <CategoricalDonutView
          data={data}
          categoryKey={categoryKey}
          valueKey={valueKey}
          metricName={metricName}
          formatDynamic={formatDynamic}
        />
      </div>
    );
  }

  if (viewMode === 'horizontal') {
    return (
      <div className="relative z-10 min-h-[320px] w-full">
        <CategoricalHorizontalView
          data={data}
          categoryKey={categoryKey}
          valueKey={valueKey}
          metricName={metricName}
          formatDynamic={formatDynamic}
        />
      </div>
    );
  }

  return (
    <div className="relative z-10 h-[320px] w-full overflow-hidden">
      <ParentSize debounceTime={10}>
        {({ width, height }) => {
          const chartWidth = Math.max(width || 0, 300);
          const chartHeight = height > 50 ? height : 320;
          return (
            <CategoricalChartInner
              data={data}
              width={chartWidth}
              height={chartHeight}
              categoryKey={categoryKey}
              valueKey={valueKey}
              metricName={metricName}
            />
          );
        }}
      </ParentSize>
    </div>
  );
}
