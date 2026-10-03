'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  ComposedChart,
} from 'recharts';
import {
  BarChart3,
  LineChart as LineIcon,
  PieChart as PieIcon,
  Activity,
  Layers,
  Sparkles,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { CHART_COLORS, SERIES_PALETTE, tooltipStyles } from '@/legacy/lib/chartTheme';
import { cn } from '@/lib/utils';

export interface ChartSpec {
  type: 'line' | 'bar' | 'scatter' | 'pie' | 'area' | 'stacked_bar' | 'dual_axis';
  title: string;
  description?: string;
  x_key: string;
  y_keys: string[];
  data: Record<string, any>[];
  secondary_y_keys?: string[]; // for dual_axis
  meta?: {
    y_axis_label?: string;
    secondary_y_axis_label?: string;
    unit?: string;
    is_percentage?: boolean;
    is_currency?: boolean;
  };
}

// Restrained analogous series palette (see lib/chartTheme).
const SERIES_COLORS = SERIES_PALETTE;

// Contextual formatter: currency, percentage, or compact integer
export const formatMetricValue = (val: any, keyName?: string) => {
  if (typeof val !== 'number') return String(val ?? '—');

  const keyLower = (keyName || '').toLowerCase();
  const isPercent = keyLower.includes('pct') || keyLower.includes('percent') || keyLower.includes('rate') || keyLower.includes('margin');
  const isCurrency = keyLower.includes('rev') || keyLower.includes('sales') || keyLower.includes('price') || keyLower.includes('cost') || keyLower.includes('amount') || keyLower.includes('spend');

  if (isPercent) {
    return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
  }

  if (isCurrency || Math.abs(val) >= 1000) {
    if (Math.abs(val) >= 1_000_000_000) return `₹${(val / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(val) >= 1_000_000) return `₹${(val / 1_000_000).toFixed(2)}M`;
    if (Math.abs(val) >= 1_000) return `₹${(val / 1_000).toFixed(1)}k`;
  }

  return val.toLocaleString('en-IN');
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div style={tooltipStyles} className="min-w-[180px] max-w-xs">
      {label && (
        <div className="mb-2 flex items-center justify-between border-b border-hairline pb-1.5">
          <span className="text-xs font-semibold text-ink">{label}</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-signal">Observed</span>
        </div>
      )}
      <div className="space-y-1.5">
        {payload.map((entry: any, index: number) => {
          const color = entry.color || entry.fill || SERIES_COLORS[index % SERIES_COLORS.length];
          return (
            <div key={`tooltip-${index}`} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-1.5 truncate text-ink-secondary">
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span className="truncate">{entry.name?.replace(/_/g, ' ')}:</span>
              </span>
              <span className="flex-shrink-0 font-mono font-semibold tabular-nums text-ink">
                {formatMetricValue(entry.value, entry.name || entry.dataKey)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function DynamicChartRenderer({ chart }: { chart: ChartSpec }) {
  const primaryYKeys = chart?.y_keys && chart.y_keys.length > 0 ? chart.y_keys : ['value'];

  const [viewType, setViewType] = useState<ChartSpec['type']>(chart?.type || 'bar');

  useEffect(() => {
    if (chart?.type) {
      setViewType(chart.type);
    }
  }, [chart?.type]);

  // Process data for Donut/Pie: top 8 items + aggregated 'Other' slice to prevent crowding
  const pieData = useMemo(() => {
    if (!chart?.data || chart.data.length <= 8) return chart.data;
    const valKey = primaryYKeys[0] || 'value';
    const sorted = [...chart.data].sort((a, b) => (Number(b[valKey]) || 0) - (Number(a[valKey]) || 0));
    const top7 = sorted.slice(0, 7);
    const rest = sorted.slice(7);
    const restTotal = rest.reduce((acc, r) => acc + (Number(r[valKey]) || 0), 0);
    if (restTotal > 0) {
      return [...top7, { [chart.x_key]: 'Other Segments', [valKey]: restTotal }];
    }
    return top7;
  }, [chart?.data, chart?.x_key, primaryYKeys]);

  // Empty data fallback
  if (!chart || !chart.data || chart.data.length === 0) {
    return (
      <div className="panel my-4 p-6 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <AlertCircle className="h-4 w-4 text-signal" strokeWidth={1.5} />
          <h4 className="text-caption">{chart?.title || 'Chart'}</h4>
        </div>
        <p className="text-xs text-ink-muted">No data returned for this view.</p>
      </div>
    );
  }

  const secondaryYKeys = chart.secondary_y_keys || (chart.type === 'dual_axis' && primaryYKeys.length > 1 ? [primaryYKeys[1]] : []);
  const leftYKeys = (viewType === 'dual_axis' || chart.type === 'dual_axis') && secondaryYKeys.length > 0 ? [primaryYKeys[0]] : primaryYKeys;

  const SWITCHABLE_TYPES: { type: ChartSpec['type']; label: string; icon: React.ReactNode }[] = [
    { type: 'bar', label: 'Bar', icon: <BarChart3 className="w-3 h-3" /> },
    { type: 'line', label: 'Line', icon: <LineIcon className="w-3 h-3" /> },
    { type: 'area', label: 'Area', icon: <Activity className="w-3 h-3" /> },
    { type: 'pie', label: 'Donut', icon: <PieIcon className="w-3 h-3" /> },
  ];

  const getIcon = () => {
    switch (viewType) {
      case 'line':
      case 'dual_axis':
        return <LineIcon className="h-4 w-4 text-signal" strokeWidth={1.5} />;
      case 'area':
        return <Activity className="h-4 w-4 text-signal" strokeWidth={1.5} />;
      case 'bar':
      case 'stacked_bar':
        return <BarChart3 className="h-4 w-4 text-positive" strokeWidth={1.5} />;
      case 'pie':
        return <PieIcon className="h-4 w-4 text-signal" strokeWidth={1.5} />;
      default:
        return <Sparkles className="h-4 w-4 text-signal" strokeWidth={1.5} />;
    }
  };

  return (
    <div className="panel my-4 w-full max-w-full overflow-hidden p-4 sm:p-5">
      {/* Header with chart-type switcher */}
      <div className="mb-3 flex flex-col gap-2.5 border-b border-hairline pb-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5 pr-2">
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[var(--r-xs)] border border-hairline bg-graphite-800">
            {getIcon()}
          </span>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold tracking-tight text-ink">{chart.title}</h4>
            {chart.description && (
              <p className="truncate text-[11px] text-ink-muted">{chart.description}</p>
            )}
          </div>
        </div>

        {/* Chart type switcher */}
        <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-[var(--r-sm)] border border-hairline bg-graphite-900 p-0.5">
            {SWITCHABLE_TYPES.map((st) => {
              const isActive = viewType === st.type;
              return (
                <button
                  key={st.type}
                  type="button"
                  onClick={() => setViewType(st.type)}
                  className={cn(
                    'flex items-center gap-1 rounded-[var(--r-xs)] px-2.5 py-1 text-[11px] transition-colors duration-[var(--dur-fast)]',
                    isActive
                      ? 'bg-signal/15 text-signal font-semibold'
                      : 'text-ink-muted hover:bg-graphite-750 hover:text-ink'
                  )}
                  title={`Render data as ${st.label}`}
                >
                  {st.icon}
                  <span>{st.label}</span>
                </button>
              );
            })}
            {['scatter', 'stacked_bar', 'dual_axis'].includes(chart.type) && (
              <button
                type="button"
                onClick={() => setViewType(chart.type)}
                className={cn(
                  'flex items-center gap-1 rounded-[var(--r-xs)] px-2 py-1 text-[10px] transition-colors duration-[var(--dur-fast)]',
                  viewType === chart.type
                    ? 'bg-signal/15 font-semibold text-signal'
                    : 'text-ink-muted hover:bg-graphite-750 hover:text-ink'
                )}
                title={`Original: ${chart.type.replace(/_/g, ' ')}`}
              >
                <Sparkles className="h-3 w-3" />
                <span className="hidden sm:inline">{chart.type.replace(/_/g, ' ')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chart Canvas with Zero Overflow Guarantee */}
      <div className="h-64 sm:h-72 w-full min-w-0 overflow-hidden pt-2">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          {(() => {
            switch (viewType) {
              case 'line':
                return (
                  <LineChart data={chart.data} margin={{ top: 10, right: 15, left: 0, bottom: 20 }}>
                    <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                    <XAxis
                      dataKey={chart.x_key}
                      stroke={CHART_COLORS.gridStrong}
                      tick={{ fill: CHART_COLORS.axis, fontSize: 10 }}
                      tickLine={false}
                    />
                    <YAxis
                      stroke={CHART_COLORS.gridStrong}
                      tick={{ fill: CHART_COLORS.axis, fontSize: 10 }}
                      tickFormatter={(val) => formatMetricValue(val, leftYKeys[0])}
                      tickLine={false}
                      width={50}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {leftYKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />}
                    {leftYKeys.map((yKey, i) => (
                      <Line
                        key={yKey}
                        type="monotone"
                        dataKey={yKey}
                        stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: SERIES_COLORS[i % SERIES_COLORS.length] }}
                        activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                      />
                    ))}
                  </LineChart>
                );

              case 'area':
                return (
                  <AreaChart data={chart.data} margin={{ top: 10, right: 15, left: 0, bottom: 20 }}>
                    <defs>
                      {leftYKeys.map((yKey, i) => (
                        <linearGradient key={`grad-${yKey}`} id={`grad-${yKey}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={0.02} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                    <XAxis
                      dataKey={chart.x_key}
                      stroke={CHART_COLORS.gridStrong}
                      tick={{ fill: CHART_COLORS.axis, fontSize: 10 }}
                      tickLine={false}
                    />
                    <YAxis
                      stroke={CHART_COLORS.gridStrong}
                      tick={{ fill: CHART_COLORS.axis, fontSize: 10 }}
                      tickFormatter={(val) => formatMetricValue(val, leftYKeys[0])}
                      tickLine={false}
                      width={50}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {leftYKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />}
                    {leftYKeys.map((yKey, i) => (
                      <Area
                        key={yKey}
                        type="monotone"
                        dataKey={yKey}
                        stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill={`url(#grad-${yKey})`}
                      />
                    ))}
                  </AreaChart>
                );

              case 'stacked_bar':
                return (
                  <BarChart data={chart.data} margin={{ top: 10, right: 15, left: 0, bottom: 20 }}>
                    <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                    <XAxis
                      dataKey={chart.x_key}
                      stroke={CHART_COLORS.gridStrong}
                      tick={{ fill: CHART_COLORS.axis, fontSize: 10 }}
                      tickLine={false}
                    />
                    <YAxis
                      stroke={CHART_COLORS.gridStrong}
                      tick={{ fill: CHART_COLORS.axis, fontSize: 10 }}
                      tickFormatter={(val) => formatMetricValue(val, leftYKeys[0])}
                      tickLine={false}
                      width={50}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    {leftYKeys.map((yKey, i) => (
                      <Bar
                        key={yKey}
                        dataKey={yKey}
                        stackId="stack-a"
                        fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                        radius={i === leftYKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                );

              case 'bar':
                return (
                  <BarChart data={chart.data} margin={{ top: 10, right: 15, left: 0, bottom: 20 }}>
                    <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                    <XAxis
                      dataKey={chart.x_key}
                      stroke={CHART_COLORS.gridStrong}
                      tick={{ fill: CHART_COLORS.axis, fontSize: 10 }}
                      tickLine={false}
                    />
                    <YAxis
                      stroke={CHART_COLORS.gridStrong}
                      tick={{ fill: CHART_COLORS.axis, fontSize: 10 }}
                      tickFormatter={(val) => formatMetricValue(val, leftYKeys[0])}
                      tickLine={false}
                      width={50}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {leftYKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />}
                    {leftYKeys.map((yKey, i) => (
                      <Bar
                        key={yKey}
                        dataKey={yKey}
                        fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                );

              case 'dual_axis':
                return (
                  <ComposedChart data={chart.data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                    <XAxis
                      dataKey={chart.x_key}
                      stroke={CHART_COLORS.gridStrong}
                      tick={{ fill: CHART_COLORS.axis, fontSize: 10 }}
                      tickLine={false}
                    />
                    {/* Primary Left Y Axis */}
                    <YAxis
                      yAxisId="left"
                      stroke={CHART_COLORS.trace}
                      tick={{ fill: CHART_COLORS.trace, fontSize: 10 }}
                      tickFormatter={(val) => formatMetricValue(val, leftYKeys[0])}
                      tickLine={false}
                      width={55}
                    />
                    {/* Secondary Right Y Axis */}
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#00E599"
                      tick={{ fill: '#00E599', fontSize: 10 }}
                      tickFormatter={(val) => formatMetricValue(val, secondaryYKeys[0] || 'rate')}
                      tickLine={false}
                      width={55}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    {/* Primary Series (Bars or Area) */}
                    {leftYKeys.map((yKey) => (
                      <Bar
                        key={yKey}
                        yAxisId="left"
                        dataKey={yKey}
                        fill={CHART_COLORS.trace}
                        opacity={0.85}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                    {/* Secondary Series (Line) */}
                    {secondaryYKeys.map((yKey) => (
                      <Line
                        key={yKey}
                        yAxisId="right"
                        type="monotone"
                        dataKey={yKey}
                        stroke="#00E599"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#00E599' }}
                      />
                    ))}
                  </ComposedChart>
                );

              case 'pie':
                return (
                  <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Pie
                      data={pieData}
                      dataKey={primaryYKeys[0] || 'value'}
                      nameKey={chart.x_key}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={4}
                      stroke={CHART_COLORS.surface}
                      strokeWidth={2}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                );

              case 'scatter':
                return (
                  <ScatterChart margin={{ top: 10, right: 15, left: 0, bottom: 20 }}>
                    <CartesianGrid stroke={CHART_COLORS.grid} />
                    <XAxis
                      dataKey={chart.x_key}
                      name={chart.x_key}
                      type="number"
                      stroke={CHART_COLORS.gridStrong}
                      tick={{ fill: CHART_COLORS.axis, fontSize: 10 }}
                      tickFormatter={(v) => formatMetricValue(v, chart.x_key)}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey={chart.y_keys?.[0] || 'value'}
                      name={chart.y_keys?.[0] || 'value'}
                      type="number"
                      stroke={CHART_COLORS.gridStrong}
                      tick={{ fill: CHART_COLORS.axis, fontSize: 10 }}
                      tickFormatter={(v) => formatMetricValue(v, chart.y_keys?.[0])}
                      tickLine={false}
                      width={50}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Scatter
                      name={chart.title}
                      data={chart.data}
                      fill={CHART_COLORS.trace}
                    />
                  </ScatterChart>
                );

              default:
                return null;
            }
          })()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
