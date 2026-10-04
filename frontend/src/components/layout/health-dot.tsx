'use client';

import { Popover } from 'radix-ui';
import { useHealth } from '@/lib/hooks/queries';
import { cn } from '@/lib/utils';
import { summarizeHealth, type HealthSummary, type HealthTone } from './health';

const dots: Record<HealthTone, string> = {
  ok: 'bg-positive',
  degraded: 'bg-warning',
  down: 'bg-negative',
  checking: 'bg-ink-3',
};

const pills: Record<HealthTone, string> = {
  ok: 'bg-positive-tint text-positive',
  degraded: 'bg-warning-tint text-warning',
  down: 'bg-negative-tint text-negative',
  checking: 'bg-black/5 text-ink-2',
};

/** The status as a pill (Settings, gallery). */
export function HealthPillView({ summary, className }: { summary: Pick<HealthSummary, 'tone' | 'label' | 'details'>; className?: string }) {
  return (
    <span role="status" title={summary.details.join('\n') || undefined} className={cn('inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold', pills[summary.tone], className)}>
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', dots[summary.tone])} />
      <span className="truncate">{summary.label}</span>
    </span>
  );
}

/** A coloured dot for the nav pill. Click for the full status; the text is always available to screen readers. */
export function HealthDotView({ summary }: { summary: HealthSummary }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`System status: ${summary.label}`}
        title={summary.label}
        className="grid size-9 place-items-center rounded-full outline-none transition-colors hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span aria-hidden className={cn('size-2.5 rounded-full ring-4 ring-black/[0.03]', dots[summary.tone])} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={10}
          align="end"
          className="z-50 w-72 origin-[var(--radix-popover-content-transform-origin)] rounded-panel border border-border bg-surface-solid p-4 shadow-menu outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 duration-200"
        >
          <p role="status" className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span aria-hidden className={cn('size-2 rounded-full', dots[summary.tone])} />
            {summary.label}
          </p>
          {summary.details.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs capitalize text-ink-3">
              {summary.details.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Reflects /health: green all normal, amber degraded, red offline. */
export function HealthDot() {
  const { data, error, isPending } = useHealth();
  return <HealthDotView summary={summarizeHealth(data, error, isPending)} />;
}
