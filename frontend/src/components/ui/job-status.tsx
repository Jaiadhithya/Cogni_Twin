'use client';

import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { duration, ease, usePrefersReducedMotion } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { TrainingPhase } from '@/lib/hooks/training';

export interface JobStatusProps {
  phase: TrainingPhase;
  /** The job's own error text on failure, shown verbatim. */
  error?: string | null;
  /** Polling gave up before the job finished. */
  timedOut?: boolean;
  className?: string;
}

const STEPS = [
  { key: 'queued', label: 'Queued' },
  { key: 'running', label: 'Fitting' },
  { key: 'succeeded', label: 'Done' },
] as const;

const headline: Record<TrainingPhase, string> = {
  idle: 'No training in progress',
  queued: 'Waiting for a free worker…',
  running: 'Fitting the forecasting model…',
  succeeded: 'Model trained',
  failed: 'Training failed',
};

function Check({ reduced }: { reduced: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <motion.path
        d="M5 12.5l4.5 4.5L19 7.5"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: duration.emphasis, ease: ease.out }}
      />
    </svg>
  );
}

/**
 * Training progress: queued → fitting → done, with a shimmering bar while work is happening
 * and a drawn check-mark on success. Announced to screen readers (aria-live).
 */
export function JobStatus({ phase, error, timedOut, className }: JobStatusProps) {
  const reduced = usePrefersReducedMotion();
  const stepIndex = phase === 'queued' ? 0 : phase === 'running' ? 1 : phase === 'succeeded' ? 2 : -1;
  const working = (phase === 'queued' || phase === 'running') && !timedOut;
  const progress = phase === 'succeeded' ? 1 : phase === 'running' ? 0.6 : phase === 'queued' ? 0.2 : 0;

  return (
    <div
      aria-live="polite"
      className={cn('rounded-panel border border-border bg-surface-solid p-4', className)}
      data-phase={phase}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-full',
            phase === 'succeeded' && 'bg-positive-tint text-positive',
            phase === 'failed' && 'bg-negative-tint text-negative',
            working && 'bg-primary-tint text-primary-ink',
            phase === 'idle' && 'bg-black/5 text-ink-3',
          )}
        >
          {phase === 'succeeded' ? <Check reduced={reduced} /> : phase === 'failed' ? <AlertCircle className="size-5" strokeWidth={1.75} /> : <span className="size-2 rounded-full bg-current" />}
        </span>
        <p className="text-sm font-semibold text-ink">{timedOut ? 'Still training…' : headline[phase]}</p>
      </div>

      {phase !== 'idle' && phase !== 'failed' && (
        <>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/[0.07]" role="progressbar" aria-label="Training progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <motion.div
              className="relative h-full origin-left overflow-hidden rounded-full bg-primary"
              initial={false}
              animate={{ scaleX: progress }}
              transition={{ duration: duration.emphasis, ease: ease.out }}
              style={{ width: '100%' }}
            >
              {working && !reduced && (
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                  style={{ animation: 'progress-sheen 1.6s var(--ease-state) infinite' }}
                />
              )}
            </motion.div>
          </div>
          <ol className="mt-3 flex justify-between text-xs">
            {STEPS.map((step, index) => (
              <li key={step.key} className={cn('font-medium', index <= stepIndex ? 'text-ink' : 'text-ink-3')} aria-current={index === stepIndex ? 'step' : undefined}>
                {step.label}
              </li>
            ))}
          </ol>
        </>
      )}

      {timedOut && (
        <p className="mt-3 text-sm text-warning">
          Training is taking longer than expected. It is still running on the server; check back in a few minutes.
        </p>
      )}
      {phase === 'failed' && (
        <p role="alert" className="mt-3 rounded-control bg-negative-tint px-3 py-2 text-sm text-negative">
          {error ?? 'Training failed.'}
        </p>
      )}
    </div>
  );
}
