'use client';

import { DataState } from '@/components/ui/data-state';
import { GlassCard } from '@/components/ui/glass-card';
import { MethodLabel } from '@/components/ui/method-label';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { humanizeLever } from '@/lib/forecast';
import { formatInrDelta } from '@/lib/formatters';
import { useExplanation } from '@/lib/hooks/queries';
import { cn } from '@/lib/utils';
import type { LeverForce } from '@/lib/api/types';

interface Driver {
  feature: string;
  contribution: number;
  description: string;
}

function DriverList({ drivers, tone }: { drivers: Driver[]; tone: 'positive' | 'negative' }) {
  const max = Math.max(1, ...drivers.map((d) => Math.abs(d.contribution)));
  if (drivers.length === 0) return <p className="text-sm text-ink-3">None.</p>;
  return (
    <ul className="space-y-3">
      {drivers.map((d) => (
        <li key={d.feature}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-ink">{humanizeLever(d.feature)}</span>
            <span className={cn('tabular-nums', tone === 'positive' ? 'text-positive' : 'text-negative')}>{formatInrDelta(d.contribution, true)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[0.06]" aria-hidden>
            <div className={cn('h-full rounded-full', tone === 'positive' ? 'bg-positive' : 'bg-negative')} style={{ width: `${(Math.abs(d.contribution) / max) * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-ink-3">{d.description}</p>
        </li>
      ))}
    </ul>
  );
}

/** What is pushing the forecast up or down, with the method that produced it. */
export function AttributionPanel({ forecastDate, scenarioForces }: { forecastDate: string | undefined; scenarioForces: LeverForce[] }) {
  const query = useExplanation('aggregate', forecastDate);
  return (
    <GlassCard as="section" aria-label="Forecast drivers" className="space-y-5">
      <div>
        <h2 className="t-h2">What is driving the forecast</h2>
        <p className="mt-0.5 text-sm text-ink-3">Factors that push the forecast up or down on {forecastDate ?? 'the next day'}.</p>
      </div>

      <DataState
        query={query}
        errorTitle="Driver explanation unavailable"
        skeleton={
          <div className="space-y-4">
            <SkeletonText lines={2} />
            <Skeleton className="h-24 w-full" />
          </div>
        }
      >
        {(data) => (
          <div className="space-y-5">
            {data.explanation_text && <p className="text-[15px] text-ink-2">{data.explanation_text}</p>}
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="t-label mb-3">Pushing up</h3>
                <DriverList tone="positive" drivers={data.top_positive_drivers ?? []} />
              </div>
              <div>
                <h3 className="t-label mb-3">Pulling down</h3>
                <DriverList tone="negative" drivers={data.top_negative_drivers ?? []} />
              </div>
            </div>
            <div className="space-y-1.5 border-t border-border pt-4">
              <MethodLabel method={data.method ?? 'prophet_component_decomposition'} note={data.method_note} />
              <p className="text-xs text-ink-3">Drivers come from the most recently trained model.</p>
            </div>
          </div>
        )}
      </DataState>

      {scenarioForces.length > 0 && (
        <div className="border-t border-border pt-4">
          <h3 className="t-label mb-3">Effect of your what-if levers</h3>
          <ul className="space-y-2">
            {scenarioForces.map((f) => (
              <li key={f.feature} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ink-2">
                  <span className="font-medium text-ink">{humanizeLever(f.feature)}</span> {f.mutation}
                </span>
                <span className={cn('tabular-nums', f.delta_force >= 0 ? 'text-positive' : 'text-negative')}>{formatInrDelta(f.delta_force, true)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassCard>
  );
}
