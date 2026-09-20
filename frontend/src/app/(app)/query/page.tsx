'use client';

import { useState, useRef, useEffect } from 'react';
import { executeQuery } from '@/lib/api';
import { SAMPLE_QUERIES, DEMO_SUMMARY_DATA } from '@/lib/mockData';
import {
  Send,
  Bot,
  User,
  Database,
  AlertCircle,
  Loader2,
  Sparkles,
  Copy,
  Check,
  Code2,
  TrendingUp,
  TrendingDown,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DynamicChartRenderer from '@/components/query/DynamicChartRenderer';
import { useDataset } from '@/context/DatasetContext';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  type: 'text' | 'result' | 'error';
  content: any;
  timestamp: string;
}

export default function QueryPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      type: 'result',
      timestamp: 'Just now',
      content: {
        source: 'DEMO',
        confidence: 'low',
        answer:
          "I'm the CogniTwin analyst. Ask me anything about the active dataset — revenue by region, top products, what-if price scenarios — and I'll translate it to SQL, run it, and explain the result.",
      },
    },
  ]);
  const { activeDatasetId, activeDataset, activeSummary } = useDataset();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const summary = activeSummary || DEMO_SUMMARY_DATA;
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [queryHistory] = useState<string[]>([
    'What if we increase unit price by 15% across all categories?',
    'Show top revenue drivers and regional distribution for active quarter',
    'Explain the main SHAP drivers behind the 90-day forecast projection',
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }, 60);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleQueryExecution = async (questionText: string) => {
    const question = questionText.trim();
    if (!question || loading) return;

    setInput('');
    const timeNow = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        type: 'text',
        content: question,
        timestamp: timeNow,
      },
    ]);
    setLoading(true);

    try {
      const effectiveDatasetId = activeDataset.isPreset ? undefined : activeDatasetId;
      const result = await executeQuery(question, effectiveDatasetId);
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          type: 'result',
          content: result,
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to execute query against the active dataset.';
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          type: 'error',
          content: errorMsg,
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleQueryExecution(input);
  };

  const renderDataPreview = (rawData: any) => {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return null;
    const previewData = rawData.slice(0, 5);
    const columns = Object.keys(previewData[0]);

    return (
      <div className="panel-inset mt-3 overflow-hidden">
        <div className="flex items-center justify-between border-b border-hairline px-3.5 py-2">
          <div className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-signal" strokeWidth={1.5} />
            <span className="font-mono text-[11px] font-medium text-ink">
              {rawData.length} records returned · preview
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-graphite-900/60 text-[11px] uppercase tracking-wider text-ink-muted">
              <tr>
                {columns.map((col) => (
                  <th key={col} className="px-3.5 py-2 font-semibold">
                    {col.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewData.map((row, i) => (
                <tr
                  key={i}
                  className="border-t border-hairline transition-colors duration-[var(--dur-fast)] hover:bg-graphite-750/50"
                >
                  {columns.map((col) => (
                    <td key={col} className="max-w-[200px] truncate px-3.5 py-2 text-ink-secondary">
                      {String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-80px)] max-w-6xl flex-col p-4 pb-24 sm:p-6">
      {/* Header */}
      <header className="mb-4 flex-shrink-0">
        <SectionHeader
          eyebrow="NL2SQL · Groq"
          title={<>Ask the analyst</>}
          lede={
            <>
              Natural-language routing to SQL, semantic document search, and counterfactual
              simulation over the active dataset.
            </>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {activeDataset && <span className="chip chip--signal">{activeDataset.name}</span>}
              <span className="chip">Groq GPT-OSS-120B</span>
              <span className="chip chip--positive">SHAP protocol</span>
            </div>
          }
        />
      </header>

      {/* Conversation */}
      <div className="panel flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {messages.map((msg, idx) => (
            <motion.div
              key={msg.id || idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
              className={cn('flex gap-3 sm:gap-4', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {msg.role === 'assistant' && (
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--r-sm)] border border-hairline bg-graphite-800">
                  <Bot className="h-4 w-4 text-signal" strokeWidth={1.5} />
                </span>
              )}

              <div
                className={cn(
                  'max-w-[90%] rounded-[var(--r-md)] p-5 shadow-md sm:max-w-[85%]',
                  msg.role === 'user'
                    ? 'border border-hairline-signal bg-signal/10 text-ink'
                    : 'panel-inset'
                )}
              >
                {msg.type === 'text' && (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{msg.content}</p>
                )}

                {msg.type === 'error' && (
                  <div className="flex items-start gap-2 text-xs text-negative">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                    <p>{msg.content}</p>
                  </div>
                )}

                {msg.type === 'result' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-hairline pb-3">
                      <span className="chip chip--signal">Intent: {msg.content.source || 'STRUCTURED_SQL'}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-ink-muted">{msg.timestamp}</span>
                        <span
                          className={cn(
                            'chip',
                            msg.content.confidence === 'high' ? 'chip--positive' : 'chip--signal'
                          )}
                        >
                          {(msg.content.confidence || 'high').toUpperCase()} confidence
                        </span>
                      </div>
                    </div>

                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                      {msg.content.answer}
                    </p>

                    {msg.content.insights &&
                      Array.isArray(msg.content.insights) &&
                      msg.content.insights.length > 0 && (
                        <div className="panel-inset space-y-2.5 p-4">
                          <div className="flex items-center gap-2 text-caption text-signal">
                            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
                            Executive insights
                          </div>
                          <ul className="space-y-1.5">
                            {msg.content.insights.map((insight: string, iIdx: number) => (
                              <li
                                key={iIdx}
                                className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-secondary"
                              >
                                <span
                                  className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-signal"
                                  aria-hidden="true"
                                />
                                <span>{insight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {msg.content.charts &&
                      Array.isArray(msg.content.charts) &&
                      msg.content.charts.length > 0 && (
                        <div className="space-y-4">
                          {msg.content.charts.map((chart: any, cIdx: number) => (
                            <DynamicChartRenderer key={cIdx} chart={chart} />
                          ))}
                        </div>
                      )}

                    {msg.content.prescriptive_actions &&
                      Array.isArray(msg.content.prescriptive_actions) &&
                      msg.content.prescriptive_actions.length > 0 && (
                        <div className="panel-inset space-y-3 p-4">
                          <div className="flex items-center justify-between border-b border-hairline pb-2">
                            <div className="flex items-center gap-2 text-caption text-positive">
                              <Zap className="h-3.5 w-3.5" strokeWidth={1.5} />
                              Prescriptive action plan
                            </div>
                            <span className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">
                              AI-synthesized
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            {msg.content.prescriptive_actions.map((act: any, aIdx: number) => (
                              <div
                                key={aIdx}
                                className="panel flex flex-col justify-between space-y-3 p-3.5"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span
                                      className={cn(
                                        'rounded-[var(--r-xs)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider',
                                        act.priority === 1
                                          ? 'bg-negative/15 text-negative'
                                          : act.priority === 2
                                            ? 'bg-signal/15 text-signal'
                                            : 'bg-graphite-750 text-ink-muted'
                                      )}
                                    >
                                      Priority {act.priority}
                                    </span>
                                    <span className="font-mono text-[10px] text-ink-muted">
                                      {act.timeframe}
                                    </span>
                                  </div>
                                  <p className="text-xs font-medium leading-relaxed text-ink">
                                    {act.action}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between border-t border-hairline pt-2 font-mono text-[11px]">
                                  <span className="text-ink-muted">Impact</span>
                                  <span className="font-semibold text-positive">
                                    {act.expected_impact}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {msg.content.shap_decomposition && (
                      <div className="panel-inset space-y-2 p-3.5">
                        <span className="text-caption">SHAP force attribution</span>
                        {msg.content.shap_decomposition.map((driver: any, dIdx: number) => (
                          <div key={dIdx} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              {driver.contribution >= 0 ? (
                                <TrendingUp className="h-3.5 w-3.5 text-positive" strokeWidth={1.5} />
                              ) : (
                                <TrendingDown className="h-3.5 w-3.5 text-negative" strokeWidth={1.5} />
                              )}
                              <span className="text-ink-secondary">{driver.feature}:</span>
                            </div>
                            <span
                              className={cn(
                                'font-mono font-semibold',
                                driver.contribution >= 0 ? 'text-positive' : 'text-negative'
                              )}
                            >
                              {driver.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {renderDataPreview(msg.content.raw_data)}

                    {msg.content.generated_sql && (
                      <div className="panel-inset relative mt-2 overflow-x-auto p-3.5">
                        <div className="mb-1.5 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-caption">
                            <Code2 className="h-3 w-3 text-signal" strokeWidth={1.5} />
                            Executed SQL
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.content.generated_sql, idx)}
                            className="flex items-center gap-1 text-[10px] text-ink-muted transition-colors duration-[var(--dur-fast)] hover:text-ink"
                          >
                            {copiedIndex === idx ? (
                              <>
                                <Check className="h-3 w-3 text-positive" />
                                <span className="text-positive">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <code className="block whitespace-pre-wrap font-mono text-[11px] text-signal">
                          {msg.content.generated_sql}
                        </code>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--r-sm)] border border-hairline bg-graphite-800">
                  <User className="h-4 w-4 text-ink-secondary" strokeWidth={1.5} />
                </span>
              )}
            </motion.div>
          ))}

          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start gap-3.5"
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--r-sm)] border border-hairline bg-graphite-800">
                <Bot className="h-4 w-4 text-signal" strokeWidth={1.5} />
              </span>
              <div className="panel-inset flex items-center gap-3 px-5 py-3.5">
                <Loader2 className="h-4 w-4 animate-spin text-signal" />
                <span className="font-mono text-xs text-ink-secondary">
                  Routing intent & synthesizing…
                </span>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Prompt */}
      <div className="panel mt-3 flex-shrink-0 p-4">
        <div className="mx-auto max-w-4xl space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {SAMPLE_QUERIES.map((sq, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleQueryExecution(sq.question)}
                className="chip transition-colors duration-[var(--dur-fast)] hover:border-hairline-signal hover:text-signal"
              >
                <Sparkles className="h-3 w-3" />
                {sq.question.length > 42 ? `${sq.question.slice(0, 42)}…` : sq.question}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything… e.g. 'What if we increase price by 15%?'"
              className="input !py-3 !pl-4 !pr-28 font-mono text-sm"
              disabled={loading}
              aria-label="Ask the analyst"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="btn btn-primary absolute right-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              Run
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
