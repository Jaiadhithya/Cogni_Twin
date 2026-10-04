'use client';

import { Activity } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { DataState } from '@/components/ui/data-state';
import { EmptyState } from '@/components/ui/empty-state';
import { GlassCard } from '@/components/ui/glass-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBacktest, useForecastStatus } from '@/lib/hooks/queries';
import { formatDateTime, formatNumber, formatPercent } from '@/lib/formatters';

const TIERS: Record<string, string> = { linear: 'Linear', prophet: 'Prophet', prophet_lgbm: 'Prophet + LightGBM' };

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div>
      <dt className="t-label">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
        {value}
        {note && <span className="mt-0.5 block text-xs font-normal text-ink-3">{note}</span>}
      </dd>
    </div>
  );
}

/** Small card: backtest MAPE, model tier and when it was last trained. */
export function ModelHealth({ datasetId }: { datasetId: string }) {
  const status = useForecastStatus(datasetId);
  const backtest = useBacktest(datasetId);

  return (
    <GlassCard as="section" aria-label="Model health" className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity aria-hidden className="size-4 text-ink-3" strokeWidth={1.75} />
        <h2 className="t-h2">Model health</h2>
      </div>
      <DataState
        query={status}
        skeleton={<Skeleton className="h-24 w-full" />}
        isEmpty={(s) => !s.model_available}
        empty={
          <EmptyState
            bare
            title="No trained model yet"
            description="Train a forecasting model to see forecasts, what-ifs and accuracy."
            action={
              <ButtonLink href="/forecast?retrain=1" variant="cta" size="sm">
                Train a model
              </ButtonLink>
            }
          />
        }
      >
        {(s) => (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Stat label="Model" value={TIERS[s.model_tier ?? ''] ?? s.model_tier ?? 'Unknown'} />
            <Stat label="Last trained" value={<span className="text-base">{formatDateTime(s.trained_at)}</span>} />
            <Stat label="History used" value={s.data_points_used != null ? `${formatNumber(s.data_points_used)} ${s.granularity === 'weekly' ? 'weeks' : s.granularity === 'monthly' ? 'months' : 'days'}` : '—'} />
            <div>
              <dt className="t-label">Backtest error (MAPE)</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
                {backtest.isPending ? <Skeleton className="mt-1 h-6 w-16" /> : backtest.isError ? <span className="text-sm font-normal text-negative">Unavailable</span> : backtest.data?.mape != null ? formatPercent(backtest.data.mape) : '—'}
                {backtest.isError && <span className="mt-0.5 block text-xs font-normal text-ink-3">{backtest.error.message}</span>}
                {backtest.data && (
                  <span className="mt-0.5 block text-xs font-normal text-ink-3">
                    Tested on the last {backtest.data.test_days} days{backtest.data.mape == null ? '; MAPE could not be computed (zero values)' : ''}
                  </span>
                )}
              </dd>
            </div>
          </dl>
        )}
      </DataState>
    </GlassCard>
  );
}
