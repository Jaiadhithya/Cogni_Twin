import React from 'react';
import Link from 'next/link';
import { Compass } from 'lucide-react';

/**
 * Root not-found page. Rendered for any unmatched URL, replacing Next.js's
 * default 404.
 */
export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-graphite-950 px-6 text-center text-ink">
      <div aria-hidden="true" className="bg-grid vignette pointer-events-none fixed inset-0 z-0" />

      <div className="relative z-10 flex max-w-[560px] flex-col items-center gap-6">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-hairline bg-graphite-900">
          <Compass className="h-7 w-7 text-signal" strokeWidth={1.5} />
        </span>

        <div className="space-y-3">
          <p className="font-mono text-5xl font-semibold tracking-tight text-signal">404</p>
          <h1 className="text-h2 text-ink">Signal lost</h1>
          <p className="text-sm leading-relaxed text-ink-muted">
            The coordinates you requested are not part of this observatory. The page may have been
            moved, or the link is stale.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-[var(--r-sm)] border border-hairline-signal bg-signal/10 px-5 py-2.5 text-sm font-medium text-signal transition-colors hover:bg-signal/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            Return to the observatory
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-[var(--r-sm)] border border-hairline bg-graphite-800 px-5 py-2.5 text-sm font-medium text-ink-secondary transition-colors hover:bg-graphite-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
