'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
} from 'recharts';
import { formatCurrency, formatCurrencyCompact } from '@/legacy/lib/formatters';
import {
  CHART_COLORS,
  SERIES_PALETTE,
  tooltipStyles,
  tooltipValueStyles,
} from '@/legacy/lib/chartTheme';
import { cn } from '@/lib/utils';

interface DataPoint {
  [key: string]: any;
}

function CategoricalChartTooltip({
  active,
  payload,
  categoryKey,
  valueKey,
  formatDynamic,
}: {
  active?: boolean;
  payload?: any[];
  categoryKey: string;
  valueKey: string;
  formatDynamic: (val: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload as DataPoint;
  if (!point) return null;

  return (
    <div style={tooltipStyles} className="space-y-1">
      <span className="block text-xs font-semibold text-ink">{String(point[categoryKey] ?? 'Unknown')}</span>
      <div style={tooltipValueStyles}>{formatDynamic(Number(point[valueKey]) || 0)}</div>
      {point.share !== undefined && (
        <div className="border-t border-hairline pt-1 font-mono text-[10px] text-ink-secondary">
          Share: {point.share}% of total volume
        </div>
      )}
    </div>
  );
}

function CategoricalChartInner({
  data,
  categoryKey,
  valueKey,
  metricName,
  formatDynamic,
  formatDynamicCompact,
}: {
  data: DataPoint[];
  categoryKey: string;
  valueKey: string;
  metricName?: string;
  formatDynamic: (val: number) => string;
  formatDynamicCompact: (val: number) => string;
}) {
  const chartData = useMemo(
    () =>
      data.map((d, i) => ({
        ...d,
        name: String(d[categoryKey] || 'Unknown'),
        value: Number(d[valueKey]) || 0,
        color: SERIES_PALETTE[i % SERIES_PALETTE.length],
      })),
    [data, categoryKey, valueKey]
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 16, right: 16, bottom: 32, left: 16 }}
        role="img"
        aria-label="Categorical distribution chart"
      >
        <CartesianGrid horizontal vertical={false} stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          stroke={CHART_COLORS.gridStrong}
          tickLine={false}
          angle={-25}
          textAnchor="end"
          height={48}
          interval={0}
          tick={{ fill: CHART_COLORS.axis, fontSize: 10, fontFamily: 'var(--font-jetbrains-mono), monospace' }}
        />
        <YAxis
          tickFormatter={formatDynamicCompact}
          stroke="transparent"
          tickLine={false}
          width={56}
          tick={{ fill: CHART_COLORS.axis, fontSize: 10, fontFamily: 'var(--font-jetbrains-mono), monospace' }}
        />
        <RechartsTooltip
          cursor={{ fill: 'rgba(245, 243, 239, 0.04)' }}
          content={
            <CategoricalChartTooltip
              categoryKey={categoryKey}
              valueKey={valueKey}
              formatDynamic={formatDynamic}
            />
          }
        />
        <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={64}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.16} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
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
  const formatDynamicCompact = (val: number) => {
    if (isCurrency) return formatCurrencyCompact(val);
    return Number(val).toLocaleString('en-US', { notation: 'compact' });
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
      <CategoricalChartInner
        data={data}
        categoryKey={categoryKey}
        valueKey={valueKey}
        metricName={metricName}
        formatDynamic={formatDynamic}
        formatDynamicCompact={formatDynamicCompact}
      />
    </div>
  );
}
