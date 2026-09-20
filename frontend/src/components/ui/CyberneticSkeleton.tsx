'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/** KPI skeleton — shape-matched to the final card. */
export function CyberneticKPISkeleton() {
  return (
    <div className="panel relative h-full min-h-[118px] overflow-hidden p-5">
      <div className="shimmer absolute inset-0" aria-hidden="true" />
      <div className="relative flex items-center justify-between">
        <div className="h-2.5 w-20 rounded-[var(--r-xs)] bg-graphite-700/60" />
        <div className="h-7 w-7 rounded-[var(--r-xs)] bg-graphite-700/60" />
      </div>
      <div className="relative mt-6 h-7 w-28 rounded-[var(--r-xs)] bg-graphite-700/70" />
      <div className="relative mt-2.5 h-2.5 w-16 rounded-[var(--r-xs)] bg-graphite-700/40" />
    </div>
  );
}

/** Chart skeleton — shape-matched to the chart panel. */
export function CyberneticChartSkeleton({ title = 'Loading chart' }: { title?: string }) {
  return (
    <div className="panel-elevated relative flex min-h-[360px] flex-col overflow-hidden p-6">
      <div className="shimmer absolute inset-0" aria-hidden="true" />
      <div className="relative flex items-center justify-between border-b border-hairline pb-4">
        <span className="text-caption">{title}</span>
        <div className="h-3.5 w-24 rounded-[var(--r-xs)] bg-graphite-700/60" />
      </div>

      {/* Trace-shaped placeholder — an instrument warming up, not bars */}
      <div className="relative my-auto flex h-48 items-end gap-1.5 px-1">
        {[38, 52, 44, 66, 58, 78, 62, 84, 70, 92, 74, 88].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-[2px] bg-graphite-700/50"
            style={{ height: `${h}%`, opacity: 0.35 + (i % 3) * 0.15 }}
          />
        ))}
      </div>

      <div className="relative flex items-center justify-between border-t border-hairline pt-3">
        <span className="text-caption">Sampling telemetry…</span>
        <span className="font-mono text-[10px] text-signal">SYNCING</span>
      </div>
    </div>
  );
}

/** Empty state — an invitation to act, not a dead end. */
export function ZeroDataFallback({
  title = 'No dataset selected',
  description = 'This twin has no parsed records yet. Ingest a CSV to populate telemetry, or keep exploring the demo dataset.',
  actionText = 'Ingest a dataset',
  onAction,
}: {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}) {
  return (
    <div className="panel-elevated my-6 flex flex-col items-center justify-center p-10 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--r-md)] border border-hairline-signal bg-signal/8">
        <span className="status-dot status-dot--signal" aria-hidden="true" />
      </div>
      <h4 className="text-h3 text-ink">{title}</h4>
      <p className="text-lede mx-auto mt-2 max-w-md">{description}</p>
      {onAction && (
        <button onClick={onAction} className="btn btn-primary mt-6">
          {actionText}
        </button>
      )}
    </div>
  );
}

// Legacy alias kept for any existing imports.
export const KpiSkeleton = CyberneticKPISkeleton;
export const ChartSkeleton = CyberneticChartSkeleton;

// Utility re-export so callers can reach cn if needed.
export { cn };
