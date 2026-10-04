'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowUp, Sparkles } from 'lucide-react';
import { DatasetGate } from '@/components/layout/dataset-gate';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { QUESTION_MAX, STARTER_QUESTIONS, validateQuestion } from '@/lib/ask';
import { summarizeHealth } from '@/components/layout/health';
import { useAskQuestion } from '@/lib/hooks/mutations';
import { useHealth } from '@/lib/hooks/queries';
import { useVariants } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { QueryResponse } from '@/lib/api/types';
import { AnswerCard } from './answer-card';

interface Turn {
  id: number;
  question: string;
  state: 'pending' | 'done' | 'error';
  response?: QueryResponse;
  error?: unknown;
}

/** Three softly pulsing purple dots. */
function Thinking() {
  return (
    <div role="status" aria-label="The AI is thinking" className="inline-flex items-center gap-1.5 rounded-full bg-accent-tint px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span key={i} aria-hidden className="size-2 rounded-full bg-accent" style={{ animation: `dot-pulse 1.2s ${i * 0.16}s var(--ease-state) infinite` }} />
      ))}
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  const variants = useVariants('slideInRight');
  return (
    <motion.div variants={variants} initial="hidden" animate="visible" className="ml-auto max-w-[85%] rounded-[20px] rounded-br-md bg-cta px-4 py-3 text-[15px] text-white sm:max-w-[70%]">
      {children}
    </motion.div>
  );
}

function Chat({ datasetId }: { datasetId: string }) {
  const ask = useAskQuestion(datasetId);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = turns.some((t) => t.state === 'pending');

  const submit = (raw: string) => {
    const question = raw.trim();
    const problem = validateQuestion(question);
    if (problem) {
      setFieldError(problem);
      return;
    }
    if (busy) return;
    setFieldError(null);
    setDraft('');
    const id = nextId.current++;
    setTurns((current) => [...current, { id, question, state: 'pending' }]);
    ask.mutate(question, {
      onSuccess: (response) => setTurns((current) => current.map((t) => (t.id === id ? { ...t, state: 'done', response } : t))),
      onError: (error) => setTurns((current) => current.map((t) => (t.id === id ? { ...t, state: 'error', error } : t))),
    });
  };

  // "?q=…" (from the nav search) asks once, then clears itself.
  const asked = useRef(false);
  useEffect(() => {
    const q = searchParams.get('q');
    if (!q || asked.current) return;
    asked.current = true;
    submit(q);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('q');
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'end' });
  }, [turns]);

  const retry = (turn: Turn) => {
    setTurns((current) => current.filter((t) => t.id !== turn.id));
    submit(turn.question);
  };

  return (
    <div className="flex min-h-[60vh] flex-col">
      <div className="flex-1 space-y-6 pb-6" aria-live="polite">
        {turns.length === 0 && (
          <div className="glass rounded-card px-6 py-10 text-center">
            <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-accent-tint text-accent-ink">
              <Sparkles className="size-6" strokeWidth={1.75} />
            </span>
            <h2 className="t-h2 mt-3">Ask anything about your business</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">Questions are answered from your uploaded data, with charts and recommended actions.</p>
            <ul className="mt-6 flex flex-wrap justify-center gap-2">
              {STARTER_QUESTIONS.map((q) => (
                <li key={q}>
                  <button
                    type="button"
                    onClick={() => submit(q)}
                    className="rounded-full border border-border-strong bg-surface-solid px-4 py-2 text-sm text-ink-2 outline-none transition-[transform,border-color,color] duration-[140ms] hover:border-accent/50 hover:text-accent-ink focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98]"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {turns.map((turn) => (
          <div key={turn.id} className="space-y-4">
            <UserBubble>{turn.question}</UserBubble>
            {turn.state === 'pending' && (
              <div className="space-y-3">
                <Thinking />
                <Skeleton className="h-24 w-full max-w-2xl rounded-card" />
              </div>
            )}
            {turn.state === 'error' && <ErrorState error={turn.error} title="The AI could not answer that" onRetry={() => retry(turn)} />}
            {turn.state === 'done' && turn.response && <AnswerCard response={turn.response} />}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(draft);
        }}
        className="sticky bottom-4 z-10"
      >
        <div className={cn('glass flex items-end gap-2 rounded-[28px] p-2 pl-5 shadow-card-hover', fieldError && 'ring-2 ring-negative/40')}>
          <label htmlFor="ask-input" className="sr-only">
            Your question
          </label>
          <textarea
            id="ask-input"
            rows={1}
            value={draft}
            maxLength={QUESTION_MAX + 50}
            placeholder="Ask about revenue, products, trends…"
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? 'ask-error' : undefined}
            onChange={(event) => {
              setDraft(event.target.value);
              if (fieldError) setFieldError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit(draft);
              }
            }}
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-3 text-[15px] text-ink outline-none placeholder:text-ink-3"
          />
          <Button type="submit" variant="cta" size="md" className="size-11 shrink-0 px-0" aria-label="Send question" disabled={busy} loading={busy}>
            {!busy && <ArrowUp className="size-5" strokeWidth={2} />}
          </Button>
        </div>
        {fieldError && (
          <p id="ask-error" role="alert" className="mt-2 px-5 text-sm text-negative">
            {fieldError}
          </p>
        )}
      </form>
    </div>
  );
}

export function AskView() {
  const health = useHealth();
  const documentsOffline = health.data ? summarizeHealth(health.data, null, false).documentsOffline : false;
  return (
    <div className="space-y-6">
      <PageHeader title="Ask AI" description="Ask questions about your business in plain English and get answers with charts and recommended actions." />
      {documentsOffline && (
        <p role="status" className="rounded-control bg-warning-tint px-4 py-3 text-sm text-warning">
          Document search is offline. Questions about your uploaded documents cannot be answered right now; data questions still work.
        </p>
      )}
      <DatasetGate>{(datasetId) => <Chat key={datasetId} datasetId={datasetId} />}</DatasetGate>
    </div>
  );
}
