'use client';

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from '@/components/charts/chart-tooltip';
import { ChartCard } from '@/components/ui/chart-card';
import { axisProps, chartColors, chartMargin, gridProps, lineStyle, seriesColor } from '@/lib/chart-theme';
import { formatNumberCompact, formatNumber } from '@/lib/formatters';
import { chartAnimation, usePrefersReducedMotion } from '@/lib/motion';
import type { ChartSpec } from '@/lib/api/types';

const num = (value: unknown): number => (typeof value === 'number' ? value : Number(value));

/** Renders one `charts[]` entry from /query with the shared chart theme. */
export function QueryChart({ spec }: { spec: ChartSpec }) {
  const reduced = usePrefersReducedMotion();
  const anim = chartAnimation(reduced);
  const data = spec.data.map((row) => {
    const out: Record<string, unknown> = { ...row };
    for (const key of spec.y_keys) out[key] = num(row[key]);
    return out;
  });
  const first = spec.y_keys[0];
  const summary = `${spec.title}. ${spec.description ?? ''} ${data.length} data points across ${spec.y_keys.join(', ')}.`.replace(/\s+/g, ' ').trim();
  const tooltip = <ChartTooltip formatValue={(v) => formatNumber(v, Math.abs(v) < 100 ? 2 : 0)} />;

  let chart: React.ReactElement;
  switch (spec.type) {
    case 'bar':
      chart = (
        <BarChart data={data} margin={chartMargin}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={spec.x_key} {...axisProps} />
          <YAxis {...axisProps} tickFormatter={formatNumberCompact} width={56} />
          <Tooltip content={tooltip} cursor={{ fill: 'var(--color-primary-tint)' }} />
          {spec.y_keys.length > 1 && <Legend />}
          {spec.y_keys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={seriesColor(i)} radius={[8, 8, 0, 0]} {...anim} />
          ))}
        </BarChart>
      );
      break;
    case 'line':
      chart = (
        <LineChart data={data} margin={chartMargin}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={spec.x_key} {...axisProps} minTickGap={32} />
          <YAxis {...axisProps} tickFormatter={formatNumberCompact} width={56} />
          <Tooltip content={tooltip} cursor={{ stroke: chartColors.cursor }} />
          {spec.y_keys.length > 1 && <Legend />}
          {spec.y_keys.map((key, i) => (
            <Line key={key} type="monotone" dataKey={key} stroke={seriesColor(i)} {...lineStyle} {...anim} />
          ))}
        </LineChart>
      );
      break;
    case 'area':
      chart = (
        <AreaChart data={data} margin={chartMargin}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={spec.x_key} {...axisProps} minTickGap={32} />
          <YAxis {...axisProps} tickFormatter={formatNumberCompact} width={56} />
          <Tooltip content={tooltip} cursor={{ stroke: chartColors.cursor }} />
          {spec.y_keys.length > 1 && <Legend />}
          {spec.y_keys.map((key, i) => (
            <Area key={key} type="monotone" dataKey={key} stroke={seriesColor(i)} fill={seriesColor(i)} fillOpacity={0.1} {...lineStyle} {...anim} />
          ))}
        </AreaChart>
      );
      break;
    case 'scatter':
      chart = (
        <ScatterChart margin={chartMargin}>
          <CartesianGrid {...gridProps} vertical />
          <XAxis dataKey={spec.x_key} type="number" name={spec.x_key} {...axisProps} tickFormatter={formatNumberCompact} />
          <YAxis dataKey={first} type="number" name={first} {...axisProps} tickFormatter={formatNumberCompact} width={56} />
          <Tooltip content={tooltip} cursor={{ strokeDasharray: '3 4' }} />
          <Scatter data={data} fill={seriesColor(0)} fillOpacity={0.7} {...anim} />
        </ScatterChart>
      );
      break;
    case 'pie':
      chart = (
        <PieChart>
          <Tooltip content={tooltip} />
          <Legend />
          <Pie data={data} dataKey={first} nameKey={spec.x_key} innerRadius="52%" outerRadius="82%" paddingAngle={2} {...anim}>
            {data.map((_, i) => (
              <Cell key={i} fill={seriesColor(i)} />
            ))}
          </Pie>
        </PieChart>
      );
      break;
  }

  return (
    <ChartCard title={spec.title} description={spec.description ?? undefined} summary={summary} height={260}>
      <ResponsiveContainer width="100%" height="100%">
        {chart}
      </ResponsiveContainer>
    </ChartCard>
  );
}
