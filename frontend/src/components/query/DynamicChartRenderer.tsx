'use client';

import React from 'react';
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
} from 'recharts';
import { BarChart3, LineChart as LineIcon, PieChart as PieIcon, Activity } from 'lucide-react';

export interface ChartSpec {
  type: 'line' | 'bar' | 'scatter' | 'pie' | 'area';
  title: string;
  description?: string;
  x_key: string;
  y_keys: string[];
  data: Record<string, any>[];
}

const NEON_COLORS = [
  '#00F0FF', // Cyan
  '#00E599', // Emerald
  '#7000FF', // Purple
  '#FFB020', // Amber
  '#FF4466', // Crimson
  '#3B82F6', // Blue
  '#EC4899', // Pink
  '#10B981', // Mint
];

const formatNumber = (val: any) => {
  if (typeof val !== 'number') return String(val ?? '');
  if (Math.abs(val) >= 1_000_000_000) return `₹${(val / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(val) >= 1_000_000) return `₹${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `₹${(val / 1_000).toFixed(1)}k`;
  return val.toLocaleString('en-IN');
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-xl border border-white/15 bg-[#06090E]/95 p-3 shadow-2xl backdrop-blur-md">
      {label && (
        <p className="mb-2 text-xs font-mono font-semibold text-white/80 border-b border-white/10 pb-1">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => (
          <div key={`tooltip-${index}`} className="flex items-center justify-between gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-white/70">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
              {entry.name?.replace(/_/g, ' ')}:
            </span>
            <span className="font-bold text-white">
              {typeof entry.value === 'number' ? formatNumber(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function DynamicChartRenderer({ chart }: { chart: ChartSpec }) {
  if (!chart || !chart.data || chart.data.length === 0) return null;

  const getIcon = () => {
    switch (chart.type) {
      case 'line':
      case 'area':
        return <LineIcon className="w-4 h-4 text-[#00F0FF]" />;
      case 'bar':
        return <BarChart3 className="w-4 h-4 text-[#00E599]" />;
      case 'pie':
        return <PieIcon className="w-4 h-4 text-[#FFB020]" />;
      default:
        return <Activity className="w-4 h-4 text-[#7000FF]" />;
    }
  };

  return (
    <div className="my-4 rounded-2xl border border-white/10 bg-[#06090E]/90 p-4 shadow-xl backdrop-blur-sm">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.05] border border-white/10">
            {getIcon()}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white font-sans tracking-tight">
              {chart.title}
            </h4>
            {chart.description && (
              <p className="text-[11px] text-white/50 font-sans">
                {chart.description}
              </p>
            )}
          </div>
        </div>
        <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-white/60 border border-white/10">
          {chart.type}
        </span>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
          {(() => {
            switch (chart.type) {
              case 'line':
                return (
                  <LineChart data={chart.data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
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
                      tickFormatter={formatNumber}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {chart.y_keys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />}
                    {chart.y_keys.map((yKey, i) => (
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
                  <AreaChart data={chart.data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <defs>
                      {chart.y_keys.map((yKey, i) => (
                        <linearGradient key={`grad-${yKey}`} id={`grad-${yKey}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={NEON_COLORS[i % NEON_COLORS.length]} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={NEON_COLORS[i % NEON_COLORS.length]} stopOpacity={0} />
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
                      tickFormatter={formatNumber}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {chart.y_keys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />}
                    {chart.y_keys.map((yKey, i) => (
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

              case 'bar':
                return (
                  <BarChart data={chart.data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
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
                      tickFormatter={formatNumber}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {chart.y_keys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />}
                    {chart.y_keys.map((yKey, i) => (
                      <Bar
                        key={yKey}
                        dataKey={yKey}
                        fill={NEON_COLORS[i % NEON_COLORS.length]}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
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
                      innerRadius={45}
                      outerRadius={75}
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
                  <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis
                      dataKey={chart.x_key}
                      name={chart.x_key}
                      type="number"
                      stroke="#ffffff40"
                      tick={{ fill: '#ffffff60', fontSize: 10 }}
                      tickFormatter={formatNumber}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey={chart.y_keys?.[0] || 'value'}
                      name={chart.y_keys?.[0] || 'value'}
                      type="number"
                      stroke="#ffffff40"
                      tick={{ fill: '#ffffff60', fontSize: 10 }}
                      tickFormatter={formatNumber}
                      tickLine={false}
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
