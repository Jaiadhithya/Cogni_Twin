'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

/**
 * Route-level error UI. Next.js renders this when a segment throws during
 * render, in place of the broken segment and without unmounting the layout.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-center justify-center px-6 py-24 text-center sm:px-10">
      <div className="panel-signal flex w-full flex-col items-center gap-5 p-10">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-hairline-signal bg-signal/10">
          <AlertTriangle className="h-6 w-6 text-signal" strokeWidth={1.5} aria-hidden="true" />
        </span>

        <div className="space-y-2">
          <h2 className="text-h3 text-ink">This view failed to load</h2>
          <p className="text-sm leading-relaxed text-ink-muted">
            An unexpected error occurred while rendering this page. Your data is safe; this is a
            display problem.
          </p>
        </div>

        {error?.message && (
          <p className="w-full break-words rounded-[var(--r-xs)] border border-hairline bg-graphite-900/60 p-3 font-mono text-xs text-ink-muted">
            {error.message}
            {error.digest ? ` · ${error.digest}` : ''}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-[var(--r-sm)] border border-hairline-signal bg-signal/10 px-4 py-2 text-sm font-medium text-signal transition-colors hover:bg-signal/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-[var(--r-sm)] border border-hairline bg-graphite-800 px-4 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-graphite-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
