'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { describeError, isApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface ErrorStateProps {
  /** The thrown error. Its real message is shown; nothing is hidden or replaced. */
  error: unknown;
  title?: string;
  onRetry?: () => void;
  bare?: boolean;
  className?: string;
}

/** Real reason in plain language, a Retry button, and the request id when the backend gave one. */
export function ErrorState({ error, title = 'We could not load this', onRetry, bare, className }: ErrorStateProps) {
  const requestId = isApiError(error) ? error.requestId : null;
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        !bare && 'glass rounded-card',
        className,
      )}
    >
      <span aria-hidden className="grid size-12 place-items-center rounded-full bg-negative-tint text-negative">
        <AlertTriangle className="size-6" strokeWidth={1.75} />
      </span>
      <h2 className="t-h2">{title}</h2>
      <p className="max-w-md text-sm text-ink-2">{describeError(error)}</p>
      {requestId && (
        <p className="text-xs text-ink-3">
          Request ID: <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[11px] text-ink-2">{requestId}</code>
        </p>
      )}
      {onRetry && (
        <Button variant="secondary" size="sm" icon={<RotateCcw className="size-4" strokeWidth={1.75} />} onClick={onRetry} className="mt-2">
          Retry
        </Button>
      )}
    </div>
  );
}
