'use client';

import { useMemo } from 'react';
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from '@/components/charts/chart-tooltip';
import { ChartCard } from '@/components/ui/chart-card';
import { MethodLabel } from '@/components/ui/method-label';
import { axisProps, chartColors, chartMargin, gridProps, lineStyle, seriesPalette } from '@/lib/chart-theme';
import { humanizeMetric, metricFormatters } from '@/lib/dashboard';
import { bridgeActualToForecast, buildChartRows } from '@/lib/forecast';
import { formatDateShort } from '@/lib/formatters';
import { chartAnimation, usePrefersReducedMotion } from '@/lib/motion';
import type { ForecastPredict, Simulation } from '@/lib/api/types';

export interface ForecastChartProps {
  predict: ForecastPredict;
  simulation: Simulation | null;
  metric: string | undefined;
  horizonDays: number;
}

/** Actuals (blue), forecast (purple), 80% and 95% bands (purple tint) and, when run, the scenario. */
export function ForecastChart({ predict, simulation, metric, horizonDays }: ForecastChartProps) {
  const reduced = usePrefersReducedMotion();
  const fmt = metricFormatters(metric);
  const label = humanizeMetric(metric);
  const rows = useMemo(() => bridgeActualToForecast(buildChartRows(predict, simulation)), [predict, simulation]);

  const forecastTotal = predict.forecast.reduce((s, p) => s + p.predicted, 0);
  const levels = simulation?.uncertainty?.levels ? Object.keys(simulation.uncertainty.levels) : [];
  const bandLabel = simulation ? (levels.length ? `${levels.map((l) => `${l}%`).join(' and ')} range` : 'range') : 'Model range';

  const summary =
    `${label} forecast for the next ${horizonDays} days totals ${fmt.compact(forecastTotal)}.` +
    (simulation ? ` The what-if scenario totals ${fmt.compact(simulation.mutated_total)}, ${simulation.total_delta >= 0 ? 'up' : 'down'} ${fmt.compact(Math.abs(simulation.total_delta))} on the baseline.` : '');

  return (
    <ChartCard
      title={`${label} forecast`}
      description={`Last ${Math.min(predict.history.length, 60)} days of actuals and the next ${horizonDays} days`}
      summary={summary}
      height={340}
      footer={
        <div className="space-y-1.5">
          <p>
            Trained {predict.model_info.data_points_used} {predict.model_info.granularity === 'daily' ? 'days' : predict.model_info.granularity === 'weekly' ? 'weeks' : 'months'} of history.
            {simulation?.uncertainty?.notes.map((n) => ` ${n}`)}
          </p>
          {simulation?.uncertainty && <MethodLabel method={simulation.uncertainty.method} />}
          {!simulation && <p>The shaded range is the model’s own lower and upper bounds. Run a what-if to see calibrated 80% and 95% ranges.</p>}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={chartMargin}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="date" {...axisProps} tickFormatter={formatDateShort} minTickGap={40} />
          <YAxis {...axisProps} tickFormatter={fmt.compact} width={64} />
          <Tooltip content={<ChartTooltip formatValue={fmt.full} formatLabel={(l) => formatDateShort(String(l))} hide={['band80', 'band95']} />} cursor={{ stroke: chartColors.cursor }} />
          <Legend verticalAlign="top" align="right" iconType="plainline" wrapperStyle={{ fontSize: 12, color: chartColors.axis, paddingBottom: 8 }} />
          <Area type="monotone" dataKey="band95" name="95% range" stroke="none" fill={chartColors.band} fillOpacity={chartColors.bandOpacityOuter} legendType="none" connectNulls {...chartAnimation(reduced, 650)} />
          <Area type="monotone" dataKey="band80" name={bandLabel} stroke="none" fill={chartColors.band} fillOpacity={chartColors.bandOpacity} connectNulls {...chartAnimation(reduced, 650)} />
          <Line type="monotone" dataKey="actual" name="Actual" stroke={chartColors.actual} connectNulls={false} {...lineStyle} {...chartAnimation(reduced)} />
          <Line type="monotone" dataKey="forecast" name="Forecast" stroke={chartColors.forecast} strokeDasharray="6 4" connectNulls={false} {...lineStyle} {...chartAnimation(reduced, 300)} />
          {simulation && <Line type="monotone" dataKey="scenario" name="What-if" stroke={seriesPalette[2]} connectNulls={false} {...lineStyle} {...chartAnimation(reduced, 100)} />}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
