import React from 'react';

import { CyberneticKPISkeleton, CyberneticChartSkeleton } from '@/legacy/components/ui/CyberneticSkeleton';

/**
 * Route-level loading UI. Shown by Next.js while a route segment is loading,
 * replacing the blank white flash that would otherwise appear.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-[1400px] px-6 py-8 sm:px-10 lg:px-14"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading this view…</span>

      {/* Heading skeleton */}
      <div className="mb-6 flex items-center justify-between">
        <div className="h-6 w-44 rounded-[var(--r-xs)] bg-graphite-700/60" />
        <div className="h-6 w-24 rounded-[var(--r-xs)] bg-graphite-700/40" />
      </div>

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CyberneticKPISkeleton key={i} />
        ))}
      </div>

      {/* Chart panels */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CyberneticChartSkeleton title="Loading telemetry" />
        <CyberneticChartSkeleton title="Loading breakdown" />
      </div>
    </div>
  );
}
