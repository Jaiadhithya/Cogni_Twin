'use client';

import { AlertTriangle } from 'lucide-react';
import { DataState } from '@/components/ui/data-state';
import { InsightCard } from '@/components/ui/insight-card';
import { MethodLabel } from '@/components/ui/method-label';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { useExplainPrescribe } from '@/lib/hooks/queries';

const timeframe = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** The purple insight card: executive summary and prioritised actions from /forecast/explain-prescribe. */
export function InsightPanel({ datasetId, horizonDays = 30 }: { datasetId: string; horizonDays?: number }) {
  const query = useExplainPrescribe(datasetId, horizonDays);
  return (
    <DataState
      query={query}
      errorTitle="Recommendations unavailable"
      skeleton={
        <div className="glass rounded-card p-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-6 w-48" />
          <SkeletonText className="mt-4" lines={4} />
        </div>
      }
    >
      {(data) => (
        <InsightCard title="What to do next">
          <p>{data.executive_summary}</p>
          {data.anomaly_detected && (
            <p className="flex gap-2 rounded-control bg-warning-tint p-3 text-sm text-warning">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
              <span>
                <strong className="font-semibold">Unusual activity detected.</strong> {data.anomaly_description}
                {data.anomaly_root_cause?.summary && <span className="mt-1 block text-ink-2">{data.anomaly_root_cause.summary}</span>}
              </span>
            </p>
          )}
          {data.prescriptive_actions.length > 0 ? (
            <ol className="space-y-3">
              {[...data.prescriptive_actions]
                .sort((a, b) => a.priority - b.priority)
                .map((a) => (
                  <li key={a.priority + a.action} className="flex gap-3">
                    <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-white">
                      {a.priority}
                    </span>
                    <span>
                      <span className="block font-medium text-ink">{a.action}</span>
                      <span className="block text-sm text-ink-2">
                        {a.expected_impact} <span className="text-ink-3">· {timeframe(a.timeframe)}</span>
                      </span>
                    </span>
                  </li>
                ))}
            </ol>
          ) : (
            <p className="text-sm text-ink-3">The model has no specific actions for this period.</p>
          )}
          {data.anomaly_root_cause?.method && <MethodLabel method={data.anomaly_root_cause.method} />}
        </InsightCard>
      )}
    </DataState>
  );
}
