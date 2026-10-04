'use client';

import { DataState } from '@/components/ui/data-state';
import { GlassCard } from '@/components/ui/glass-card';
import { MethodLabel } from '@/components/ui/method-label';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { formatLeverValue, humanizeLever } from '@/lib/forecast';
import { formatInrCompact, formatInrDelta } from '@/lib/formatters';
import { useExplanation } from '@/lib/hooks/queries';
import { cn } from '@/lib/utils';
import type { LeverForce } from '@/lib/api/types';

interface Driver {
  feature: string;
  contribution: number;
  description: string;
  /** Levers only: the value on the explained day and the usual level it is compared with. */
  value?: number | null;
  typical?: number | null;
}

function isLever(d: Driver): d is Driver & { value: number; typical: number } {
  return d.value != null && d.typical != null;
}

/** `scale` is the largest effect across both lists, so bar lengths compare across columns. */
function DriverList({ drivers, tone, scale }: { drivers: Driver[]; tone: 'positive' | 'negative'; scale: number }) {
  const max = Math.max(1, scale);
  if (drivers.length === 0) return <p className="text-sm text-ink-3">None.</p>;
  return (
    <ul className="space-y-3">
      {drivers.map((d) => (
        <li key={d.feature}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-ink">{isLever(d) ? humanizeLever(d.feature) : d.description || humanizeLever(d.feature)}</span>
            <span className={cn('tabular-nums', tone === 'positive' ? 'text-positive' : 'text-negative')}>{formatInrDelta(d.contribution, true)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[0.06]" aria-hidden>
            <div className={cn('h-full rounded-full', tone === 'positive' ? 'bg-positive' : 'bg-negative')} style={{ width: `${(Math.abs(d.contribution) / max) * 100}%` }} />
          </div>
          {isLever(d) && (
            <p className="mt-1 text-xs text-ink-3">
              {d.value > d.typical ? 'Above' : d.value < d.typical ? 'Below' : 'At'} its usual level: {formatLeverValue(d.feature, d.value)} vs {formatLeverValue(d.feature, d.typical)}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The model's summary as bullets: one "- " line per point, or "- a - b" run together on one line. */
export function summaryPoints(text: string): string[] {
  const trimmed = text.trim();
  const parts = trimmed.includes('\n') ? trimmed.split(/\n+/) : /^[-*•]\s/.test(trimmed) ? trimmed.split(/\s+[-*•]\s+/) : [trimmed];
  return parts
    .map((line) =>
      line
        .replace(/^\s*[-*•]\s*/, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/^(\p{Extended_Pictographic}\uFE0F?)\s*(?:up|down|warning)\s*:\s*/iu, '$1 ')
        .trim(),
    )
    .filter(Boolean);
}

/** What is pushing the forecast up or down, with the method that produced it. */
export function AttributionPanel({ datasetId, forecastDate, scenarioForces }: { datasetId: string; forecastDate: string | undefined; scenarioForces: LeverForce[] }) {
  const query = useExplanation('aggregate', forecastDate, datasetId);
  return (
    <GlassCard as="section" aria-label="Forecast drivers" className="space-y-5">
      <div>
        <h2 className="t-h2">What is driving the forecast</h2>
        <p className="mt-0.5 text-sm text-ink-3">Why the baseline forecast for {forecastDate ?? 'the next day'} is what it is. Your what-if changes are shown separately below.</p>
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
        {(data) => {
          const pos = data.top_positive_drivers ?? [];
          const neg = data.top_negative_drivers ?? [];
          const scale = Math.max(0, ...[...pos, ...neg].map((d) => Math.abs(d.contribution)));
          return (
            <div className="space-y-5">
              {data.base_value != null && (
                <p className="text-sm text-ink-2">
                  Forecast <span className="font-semibold tabular-nums text-ink">{formatInrCompact(data.predicted_value)}</span> = underlying trend level{' '}
                  <span className="font-semibold tabular-nums text-ink">{formatInrCompact(data.base_value)}</span> plus the factors below.
                </p>
              )}
              {data.explanation_text && (
                <ul className="space-y-1.5 text-[15px] text-ink-2">
                  {summaryPoints(data.explanation_text).map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              )}
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="t-label mb-3">Pushing up</h3>
                  <DriverList tone="positive" drivers={pos} scale={scale} />
                </div>
                <div>
                  <h3 className="t-label mb-3">Pulling down</h3>
                  <DriverList tone="negative" drivers={neg} scale={scale} />
                </div>
              </div>
              <div className="space-y-1.5 border-t border-border pt-4">
                <MethodLabel method={data.method ?? 'prophet_component_decomposition'} note={data.method_note} />
                <p className="text-xs text-ink-3">
                A helpful lever that is below its usual level still pulls the forecast down. Drivers come from the most recently trained model.
              </p>
              </div>
            </div>
          );
        }}
      </DataState>

      {scenarioForces.length > 0 && (
        <div className="border-t border-border pt-4">
          <h3 className="t-label mb-3">Effect of your what-if changes, over the whole forecast period</h3>
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
