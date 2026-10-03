'use client';

import { useHealth } from '@/lib/hooks/queries';
import { cn } from '@/lib/utils';
import { summarizeHealth, type HealthSummary, type HealthTone } from './health';

const tones: Record<HealthTone, { pill: string; dot: string }> = {
  ok: { pill: 'bg-positive-tint text-positive', dot: 'bg-positive' },
  degraded: { pill: 'bg-warning-tint text-warning', dot: 'bg-warning' },
  down: { pill: 'bg-negative-tint text-negative', dot: 'bg-negative' },
  checking: { pill: 'bg-black/5 text-ink-2', dot: 'bg-ink-3' },
};

/** The pill itself, for a given summary. Static dot: no animation. */
export function HealthPillView({ summary, className }: { summary: Pick<HealthSummary, 'tone' | 'label' | 'details'>; className?: string }) {
  const style = tones[summary.tone];
  return (
    <span
      role="status"
      title={summary.details.join('\n') || undefined}
      className={cn('inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold', style.pill, className)}
    >
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', style.dot)} />
      <span className="truncate">{summary.label}</span>
    </span>
  );
}

/** Reflects /health: green all normal, amber degraded, red offline. */
export function HealthPill({ className }: { className?: string }) {
  const { data, error, isPending } = useHealth();
  return <HealthPillView summary={summarizeHealth(data, error, isPending)} className={className} />;
}
