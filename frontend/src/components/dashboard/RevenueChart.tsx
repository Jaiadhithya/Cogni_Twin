'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
} from 'recharts';
import { formatCurrency, formatCurrencyCompact } from '@/lib/formatters';
import { Calendar } from 'lucide-react';
import { CHART_COLORS, tooltipStyles, tooltipValueStyles } from '@/lib/chartTheme';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';

interface ChartPoint {
  date: string;
  [key: string]: any;
}

function formatDateTick(value: any) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

function RevenueChartTooltip({
  active,
  payload,
  metricName,
  yKey,
}: {
  active?: boolean;
  payload?: any[];
  metricName: string;
  yKey: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload as ChartPoint;
  if (!point) return null;

  const isCurrency = /revenue|price|sales|cost|flow/i.test(metricName);
  const raw = Number(point[yKey] || 0);

  return (
    <div style={tooltipStyles} className="space-y-1">
      <div className="text-[10px] uppercase tracking-[0.1em] text-ink-muted">{metricName}</div>
      <div style={tooltipValueStyles}>{isCurrency ? formatCurrency(raw) : raw.toLocaleString('en-US')}</div>
      <div className="border-t border-hairline pt-1 font-mono text-[10px] text-ink-secondary">
        {new Date(point.date).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </div>
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

  const isCurrency = /revenue|price|sales|cost|flow/i.test(metricName);

  const formatDynamicCompact = (val: number) => {
    if (isCurrency) return formatCurrencyCompact(val);
    return Number(val).toLocaleString('en-US', { notation: 'compact' });
  };

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
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={filteredData}
              margin={{ top: 16, right: 24, bottom: 8, left: 8 }}
              role="img"
              aria-label={`${metricName} trajectory chart`}
            >
              <defs>
                <linearGradient id="traceArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.trace} stopOpacity={0.22} />
                  <stop offset="60%" stopColor={CHART_COLORS.trace} stopOpacity={0.05} />
                  <stop offset="100%" stopColor={CHART_COLORS.trace} stopOpacity={0} />
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
                tickFormatter={formatDateTick}
                stroke={CHART_COLORS.gridStrong}
                tickLine={false}
                minTickGap={24}
                tick={{ fill: CHART_COLORS.axis, fontSize: 10, fontFamily: 'var(--font-mono)' }}
              />
              <YAxis
                tickFormatter={formatDynamicCompact}
                stroke="transparent"
                tickLine={false}
                width={56}
                domain={[0, 'dataMax']}
                allowDataOverflow
                tick={{ fill: CHART_COLORS.axis, fontSize: 10, fontFamily: 'var(--font-mono)' }}
              />
              <Tooltip
                cursor={{ stroke: CHART_COLORS.crosshair, strokeWidth: 1, strokeDasharray: '3 3' }}
                content={<RevenueChartTooltip metricName={metricName} yKey={yKey} />}
              />

              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                <Area
                  type="monotone"
                  dataKey={yKey}
                  stroke={CHART_COLORS.trace}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="url(#traceArea)"
                  isAnimationActive={false}
                  dot={false}
                  activeDot={{
                    r: 4.5,
                    fill: CHART_COLORS.surface,
                    stroke: CHART_COLORS.trace,
                    strokeWidth: 2,
                  }}
                />
              </motion.g>

              {filteredData.length > 0 && (
                <ReferenceDot
                  x={filteredData[filteredData.length - 1].date}
                  y={Number(filteredData[filteredData.length - 1][yKey]) || 0}
                  r={4.5}
                  fill={CHART_COLORS.surface}
                  stroke={CHART_COLORS.trace}
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
