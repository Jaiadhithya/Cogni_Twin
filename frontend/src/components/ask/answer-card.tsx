'use client';

import { useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/table';
import { RevealGroup, RevealItem } from '@/components/ui/reveal';
import { SourceChip } from '@/components/ui/source-chip';
import { inferSource, tableRows } from '@/lib/ask';
import { cn } from '@/lib/utils';
import type { QueryResponse } from '@/lib/api/types';
import { QueryChart } from './query-chart';

function Collapsible({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-panel border border-border bg-surface-solid/70">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-panel px-4 py-2.5 text-left text-sm font-medium text-ink-2 outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-primary"
      >
        {label}
        <ChevronDown aria-hidden className={cn('size-4 text-ink-3 transition-transform duration-200', open && 'rotate-180')} strokeWidth={1.75} />
      </button>
      {open && <div className="border-t border-border p-4">{children}</div>}
    </div>
  );
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString('en-IN') : value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return String(value);
}

/**
 * An AI answer: text first, then charts draw, then insights and actions stagger in. Purple
 * marks it as model output. Shows the source and confidence, with SQL and data on request.
 */
export function AnswerCard({ response: raw }: { response: QueryResponse }) {
  const response = { ...raw, charts: raw.charts ?? [], insights: raw.insights ?? [], prescriptive_actions: raw.prescriptive_actions ?? [] };
  const source = inferSource(response);
  const data = tableRows(response);
  const columns: Column<Record<string, unknown>>[] = data.length
    ? Object.keys(data[0]).map((key) => ({
        key,
        header: key.replace(/_/g, ' '),
        cell: (row) => cell(row[key]),
        sortValue: (row) => (typeof row[key] === 'number' ? (row[key] as number) : row[key] == null ? null : String(row[key])),
        numeric: typeof data[0][key] === 'number',
      }))
    : [];

  return (
    <RevealGroup className="glass space-y-4 rounded-card border-accent/20 bg-accent-tint p-4 sm:p-6" aria-label="AI answer" role="article">
      <RevealItem>
        <div className="mb-2 flex items-center gap-2 text-accent-ink">
          <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />
          <span className="text-xs font-semibold uppercase tracking-[0.06em]">AI answer</span>
        </div>
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{response.answer}</p>
      </RevealItem>

      {response.charts.length > 0 && (
        <RevealItem className={cn('grid gap-4', response.charts.length > 1 && 'lg:grid-cols-2')}>
          {response.charts.map((spec, i) => (
            <QueryChart key={`${spec.title}-${i}`} spec={spec} />
          ))}
        </RevealItem>
      )}

      {response.insights.length > 0 && (
        <RevealItem>
          <h3 className="t-label mb-1.5">Insights</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
            {response.insights.map((insight) => (
              <li key={insight}>{insight}</li>
            ))}
          </ul>
        </RevealItem>
      )}

      {response.prescriptive_actions.length > 0 && (
        <RevealItem>
          <h3 className="t-label mb-2">Recommended actions</h3>
          <RevealGroup className="grid gap-3 sm:grid-cols-2">
            {[...response.prescriptive_actions]
              .sort((a, b) => a.priority - b.priority)
              .map((a) => (
                <RevealItem key={a.action} className="rounded-panel border border-border bg-surface-solid p-3.5">
                  <p className="flex items-start gap-2 text-sm font-medium text-ink">
                    <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-semibold text-white">
                      {a.priority}
                    </span>
                    {a.action}
                  </p>
                  <p className="mt-1.5 pl-7 text-xs text-ink-3">
                    {a.expected_impact} · {a.timeframe}
                  </p>
                </RevealItem>
              ))}
          </RevealGroup>
        </RevealItem>
      )}

      <RevealItem className="flex flex-wrap items-center gap-2">
        {source ? <SourceChip source={source} confidence={response.confidence} /> : <span className="rounded-full border border-border bg-surface-solid px-2.5 py-1 text-xs font-medium capitalize text-ink-2">{response.confidence} confidence</span>}
        {response.confidence === 'low' && <span className="text-xs text-warning">Low confidence: treat this answer with care.</span>}
      </RevealItem>

      {(response.generated_sql || data.length > 0) && (
        <RevealItem className="space-y-2">
          {response.generated_sql && (
            <Collapsible label="Show SQL">
              <pre className="overflow-x-auto rounded-control bg-cta p-3 font-mono text-xs leading-relaxed text-white">{response.generated_sql}</pre>
            </Collapsible>
          )}
          {data.length > 0 && (
            <Collapsible label={`Show data (${data.length} row${data.length === 1 ? '' : 's'})`}>
              <DataTable columns={columns} rows={data} rowKey={(row) => JSON.stringify(row)} caption="Data behind the answer" maxHeight={280} />
            </Collapsible>
          )}
        </RevealItem>
      )}
    </RevealGroup>
  );
}
