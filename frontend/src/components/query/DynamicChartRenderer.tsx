'use client';

import React, { useMemo } from 'react';
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
  AlertCircle
} from 'lucide-react';

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

const NEON_COLORS = [
  '#00F0FF', // Cyan
  '#00E599', // Emerald
  '#7000FF', // Violet
  '#FFB020', // Amber
  '#FF4466', // Crimson
  '#38BDF8', // Sky
  '#F43F5E', // Rose
  '#A855F7', // Purple
  '#10B981', // Mint
];

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
    <div className="rounded-xl border border-white/15 bg-[#06090E]/95 p-3.5 shadow-2xl backdrop-blur-xl min-w-[180px] max-w-xs pointer-events-none">
      {label && (
        <div className="mb-2.5 flex items-center justify-between border-b border-white/10 pb-1.5 font-mono text-[11px] text-white/80">
          <span className="font-semibold">{label}</span>
          <span className="text-[9px] text-[#00F0FF] uppercase">OBSERVED</span>
        </div>
      )}
      <div className="space-y-1.5">
        {payload.map((entry: any, index: number) => {
          const color = entry.color || entry.fill || NEON_COLORS[index % NEON_COLORS.length];
          return (
            <div key={`tooltip-${index}`} className="flex items-center justify-between gap-3 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-white/70 truncate">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="truncate">{entry.name?.replace(/_/g, ' ')}:</span>
              </span>
              <span className="font-bold text-white tabular-nums flex-shrink-0">
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
  // Empty data / zero-data fallback to prevent blank card
  if (!chart || !chart.data || chart.data.length === 0) {
    return (
      <div className="my-4 rounded-2xl border border-white/10 bg-[#06090E]/90 p-6 shadow-xl backdrop-blur-sm text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-[#FFB020]" />
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
            {chart?.title || 'Telemetry Visualization Buffer'}
          </h4>
        </div>
        <p className="text-[11px] font-mono text-white/50">
          Awaiting dimensional telemetry signals to render trajectory canvas.
        </p>
      </div>
    );
  }

  const primaryYKeys = chart.y_keys && chart.y_keys.length > 0 ? chart.y_keys : ['value'];
  const secondaryYKeys = chart.secondary_y_keys || (chart.type === 'dual_axis' && primaryYKeys.length > 1 ? [primaryYKeys[1]] : []);
  const leftYKeys = chart.type === 'dual_axis' && secondaryYKeys.length > 0 ? [primaryYKeys[0]] : primaryYKeys;

  const getIcon = () => {
    switch (chart.type) {
      case 'line':
      case 'dual_axis':
        return <LineIcon className="w-4 h-4 text-[#00F0FF]" />;
      case 'area':
        return <Activity className="w-4 h-4 text-[#00F0FF]" />;
      case 'bar':
      case 'stacked_bar':
        return <BarChart3 className="w-4 h-4 text-[#00E599]" />;
      case 'pie':
        return <PieIcon className="w-4 h-4 text-[#FFB020]" />;
      default:
        return <Sparkles className="w-4 h-4 text-[#7000FF]" />;
    }
  };

  return (
    <div className="my-4 w-full max-w-full overflow-hidden rounded-2xl border border-white/10 bg-[#06090E]/90 p-4 sm:p-5 shadow-xl backdrop-blur-md">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.05] border border-white/10">
            {getIcon()}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-white font-sans tracking-tight truncate">
              {chart.title}
            </h4>
            {chart.description && (
              <p className="text-[11px] text-white/50 font-sans truncate">
                {chart.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-white/60 border border-white/10">
            {chart.type.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Chart Canvas with Zero Overflow Guarantee */}
      <div className="h-64 sm:h-72 w-full min-w-0 overflow-hidden pt-2">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          {(() => {
            switch (chart.type) {
              case 'line':
                return (
                  <LineChart data={chart.data} margin={{ top: 10, right: 15, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis
                      dataKey={chart.x_key}
                      stroke="#ffffff40"
                      tick={{ fill: '#ffffff60', fontSize: 10 }}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#ffffff40"
                      tick={{ fill: '#ffffff60', fontSize: 10 }}
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
                        stroke={NEON_COLORS[i % NEON_COLORS.length]}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: NEON_COLORS[i % NEON_COLORS.length] }}
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
                          <stop offset="5%" stopColor={NEON_COLORS[i % NEON_COLORS.length]} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={NEON_COLORS[i % NEON_COLORS.length]} stopOpacity={0.02} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis
                      dataKey={chart.x_key}
                      stroke="#ffffff40"
                      tick={{ fill: '#ffffff60', fontSize: 10 }}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#ffffff40"
                      tick={{ fill: '#ffffff60', fontSize: 10 }}
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
                        stroke={NEON_COLORS[i % NEON_COLORS.length]}
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis
                      dataKey={chart.x_key}
                      stroke="#ffffff40"
                      tick={{ fill: '#ffffff60', fontSize: 10 }}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#ffffff40"
                      tick={{ fill: '#ffffff60', fontSize: 10 }}
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
                        fill={NEON_COLORS[i % NEON_COLORS.length]}
                        radius={i === leftYKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                );

              case 'bar':
                return (
                  <BarChart data={chart.data} margin={{ top: 10, right: 15, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis
                      dataKey={chart.x_key}
                      stroke="#ffffff40"
                      tick={{ fill: '#ffffff60', fontSize: 10 }}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#ffffff40"
                      tick={{ fill: '#ffffff60', fontSize: 10 }}
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
                        fill={NEON_COLORS[i % NEON_COLORS.length]}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                );

              case 'dual_axis':
                return (
                  <ComposedChart data={chart.data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis
                      dataKey={chart.x_key}
                      stroke="#ffffff40"
                      tick={{ fill: '#ffffff60', fontSize: 10 }}
                      tickLine={false}
                    />
                    {/* Primary Left Y Axis */}
                    <YAxis
                      yAxisId="left"
                      stroke="#00F0FF"
                      tick={{ fill: '#00F0FF', fontSize: 10 }}
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
                        fill="#00F0FF"
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
                      data={chart.data}
                      dataKey={chart.y_keys?.[0] || 'value'}
                      nameKey={chart.x_key}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={80}
                      paddingAngle={4}
                      stroke="#06090E"
                      strokeWidth={2}
                    >
                      {chart.data.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={NEON_COLORS[index % NEON_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                );

              case 'scatter':
                return (
                  <ScatterChart margin={{ top: 10, right: 15, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis
                      dataKey={chart.x_key}
                      name={chart.x_key}
                      type="number"
                      stroke="#ffffff40"
                      tick={{ fill: '#ffffff60', fontSize: 10 }}
                      tickFormatter={(v) => formatMetricValue(v, chart.x_key)}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey={chart.y_keys?.[0] || 'value'}
                      name={chart.y_keys?.[0] || 'value'}
                      type="number"
                      stroke="#ffffff40"
                      tick={{ fill: '#ffffff60', fontSize: 10 }}
                      tickFormatter={(v) => formatMetricValue(v, chart.y_keys?.[0])}
                      tickLine={false}
                      width={50}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Scatter
                      name={chart.title}
                      data={chart.data}
                      fill="#00F0FF"
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
