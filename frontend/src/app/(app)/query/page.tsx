'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { executeQuery, getSummary } from '@/lib/api';
import { SAMPLE_QUERIES, DEMO_SUMMARY_DATA } from '@/lib/mockData';
import { 
  Send, 
  Bot, 
  User, 
  Database, 
  AlertCircle, 
  Loader2, 
  Terminal, 
  Sparkles, 
  Copy, 
  Check, 
  Clock, 
  Code2, 
  TrendingUp, 
  TrendingDown, 
  Download,
  ChevronRight,
  Maximize2,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DynamicChartRenderer from '@/components/query/DynamicChartRenderer';

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
        source: 'STRUCTURED_SQL',
        confidence: 'high',
        answer: "Welcome to the Cognitia Twin Intelligence Command Console. I am your autonomous operational analyst. You can query any structured sales telemetry, execute counterfactual scenario simulations, or inspect SHAP explainability drivers in plain English.",
        generated_sql: "SELECT 'OPERATIONAL_TWIN_READY' AS status, 51280 AS indexed_records, 0.04 AS feature_drift;",
        raw_data: [
          { system_node: "Prophet Inference Engine", status: "ONLINE", latency: "14ms", confidence: "99.98%" },
          { system_node: "Groq GPT-OSS-120B Synthesizer", status: "READY", latency: "182ms", confidence: "98.4%" },
          { system_node: "Vector Knowledge Base", status: "INDEXED", latency: "6ms", confidence: "100%" },
        ]
      }
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(DEMO_SUMMARY_DATA);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [queryHistory, setQueryHistory] = useState<string[]>([
    "What if we increase unit price by 15% across all categories?",
    "Show top revenue drivers and regional distribution for active quarter",
    "Explain the main SHAP drivers behind the 90-day forecast projection"
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let initialDatasetId: string | null = null;
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        initialDatasetId = urlParams.get('dataset_id') || localStorage.getItem('active_dataset_id');
      } catch (e) {
        // ignore
      }
    }
    if (initialDatasetId) {
      setActiveDatasetId(initialDatasetId);
    }

    getSummary(initialDatasetId || undefined)
      .then((res) => {
        if (res) {
          setSummary(res);
          if (res.dataset_id && !initialDatasetId) {
            setActiveDatasetId(res.dataset_id);
          }
        }
      })
      .catch(() => setSummary(DEMO_SUMMARY_DATA));
  }, []);

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
    setQueryHistory((prev) => Array.from(new Set([question, ...prev])).slice(0, 10));
    setLoading(true);

    try {
      // Pass active dataset_id to executeQuery so queries bind explicitly to the active dataset
      const storedDatasetId = typeof window !== 'undefined' ? localStorage.getItem('active_dataset_id') : null;
      let effectiveDatasetId = activeDatasetId || storedDatasetId || summary?.dataset_id || undefined;
      if (effectiveDatasetId === 'null' || effectiveDatasetId === 'undefined' || !effectiveDatasetId) {
        effectiveDatasetId = undefined;
      }
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
      const errorMsg = err?.message || 'Failed to execute query against operational twin.';
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
      <div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-[#06090E]/90">
        <div className="px-3.5 py-2 flex items-center justify-between border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-[#00F0FF]" />
            <span className="text-[11px] font-mono font-medium text-white/80">
              Data Preview ({rawData.length} records returned)
            </span>
          </div>
          <span className="text-[9px] font-mono text-white/40 uppercase">
            PARQUET / DUCKDB ACCELERATED
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono text-white/90">
            <thead className="text-[11px] text-white/50 bg-white/[0.03] uppercase tracking-wider">
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
                  className="border-t border-white/[0.05] hover:bg-white/[0.03] transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col} className="px-3.5 py-2 truncate max-w-[200px] text-white/80">
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
    <div className="max-w-6xl mx-auto p-4 sm:p-6 pb-24 flex flex-col h-[calc(100vh-80px)]">
      
      {/* 1. Terminal Mission Control Header */}
      <header className="p-4 sm:p-5 obsidian-panel rounded-2xl mb-4 flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-white/10 shadow-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#00F0FF] shadow-[0_0_8px_#00F0FF]" />
            <span className="text-[10px] font-mono text-[#00F0FF] tracking-widest uppercase">
              SYS.CONSOLE // NATURAL LANGUAGE ANALYTICS & SIMULATION
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
            Intelligence Command Console
          </h1>
          <p className="text-xs font-sans text-white/60 mt-0.5">
            Real-time intent routing: Natural Language to SQL, RAG knowledge search, and counterfactual simulation.
          </p>
        </div>

        {/* Model & Latency Badges */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {activeDatasetId && (
            <span className="px-3 py-1 rounded-full bg-[#7928CA]/20 text-[#C084FC] border border-[#7928CA]/40 flex items-center gap-1.5 shadow-[0_0_10px_rgba(168,85,247,0.15)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C084FC]" />
              ACTIVE TWIN: {activeDatasetId.slice(0, 18)}
            </span>
          )}
          <span className="px-3 py-1 rounded-full bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,240,255,0.15)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-pulse" />
            GROQ GPT-OSS-120B
          </span>
          <span className="px-3 py-1 rounded-full bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/30 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E599]" />
            SHAP PROTOCOL ACTIVE
          </span>
        </div>
      </header>

      {/* 2. Main Chat Conversation Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 rounded-2xl obsidian-panel border border-white/10 shadow-2xl">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg, idx) => (
            <motion.div
              key={msg.id || idx}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 26 }}
              className={`flex gap-3 sm:gap-4 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {/* Bot Avatar */}
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#00F0FF]/15 border border-[#00F0FF]/30 shadow-[0_0_15px_rgba(0,240,255,0.25)]">
                  <Bot className="w-4 h-4 text-[#00F0FF]" />
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`max-w-[90%] sm:max-w-[85%] rounded-2xl p-5 shadow-2xl ${
                  msg.role === 'user'
                    ? 'bg-[#00F0FF]/15 border border-[#00F0FF]/40 text-white font-mono text-sm'
                    : 'bg-[#06090E]/90 border border-white/10'
                }`}
              >
                {/* Simple Text */}
                {msg.type === 'text' && (
                  <p className="whitespace-pre-wrap leading-relaxed text-sm text-white/95 font-sans">
                    {msg.content}
                  </p>
                )}

                {/* Error */}
                {msg.type === 'error' && (
                  <div className="flex items-start gap-2 text-[#FF4466] font-mono text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p>{msg.content}</p>
                  </div>
                )}

                {/* Structured Result */}
                {msg.type === 'result' && (
                  <div className="space-y-4">
                    
                    {/* Header Badges */}
                    <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] text-[10px] font-mono">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 font-semibold tracking-wider">
                        INTENT: {msg.content.source || 'STRUCTURED_SQL'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-white/40">{msg.timestamp}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold tracking-wider ${
                            msg.content.confidence === 'high'
                              ? 'bg-[#00E599]/15 text-[#00E599] border border-[#00E599]/30'
                              : 'bg-[#FFB020]/15 text-[#FFB020] border border-[#FFB020]/30'
                          }`}
                        >
                          {msg.content.confidence?.toUpperCase() || 'HIGH'} CONFIDENCE
                        </span>
                      </div>
                    </div>

                    {/* Synthesized Answer */}
                    <p className="whitespace-pre-wrap leading-relaxed text-sm text-white/95 font-sans">
                      {msg.content.answer}
                    </p>

                    {/* Executive Insights (if present) */}
                    {msg.content.insights && Array.isArray(msg.content.insights) && msg.content.insights.length > 0 && (
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2.5">
                        <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#00F0FF] uppercase tracking-wider">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Executive Strategic Insights</span>
                        </div>
                        <ul className="space-y-1.5">
                          {msg.content.insights.map((insight: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2.5 text-xs text-white/90 font-sans leading-relaxed">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] mt-1.5 flex-shrink-0" />
                              <span>{insight}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Declarative Multi-Column Dynamic Charts */}
                    {msg.content.charts && Array.isArray(msg.content.charts) && msg.content.charts.length > 0 && (
                      <div className="space-y-4">
                        {msg.content.charts.map((chart: any, cIdx: number) => (
                          <DynamicChartRenderer key={cIdx} chart={chart} />
                        ))}
                      </div>
                    )}

                    {/* Prioritized Prescriptive Action Plan */}
                    {msg.content.prescriptive_actions && Array.isArray(msg.content.prescriptive_actions) && msg.content.prescriptive_actions.length > 0 && (
                      <div className="rounded-xl border border-[#00E599]/30 bg-[#00E599]/[0.03] p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#00E599] uppercase tracking-wider">
                            <Zap className="w-3.5 h-3.5" />
                            <span>Prioritized Prescriptive Action Plan</span>
                          </div>
                          <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
                            AI-Synthesized Levers
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {msg.content.prescriptive_actions.map((act: any, aIdx: number) => (
                            <div key={aIdx} className="rounded-lg border border-white/10 bg-[#030507]/90 p-3.5 flex flex-col justify-between space-y-3">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                                    act.priority === 1
                                      ? 'bg-[#FF4466]/20 text-[#FF4466] border border-[#FF4466]/30'
                                      : act.priority === 2
                                      ? 'bg-[#FFB020]/20 text-[#FFB020] border border-[#FFB020]/30'
                                      : 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/30'
                                  }`}>
                                    Priority {act.priority}
                                  </span>
                                  <span className="text-[10px] font-mono text-white/50">{act.timeframe}</span>
                                </div>
                                <p className="text-xs text-white/90 font-sans font-medium leading-relaxed">{act.action}</p>
                              </div>
                              <div className="border-t border-white/[0.08] pt-2 flex items-center justify-between text-[11px] font-mono">
                                <span className="text-white/40">ROI / Impact:</span>
                                <span className="text-[#00E599] font-bold">{act.expected_impact}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SHAP Decomposition (if present) */}
                    {msg.content.shap_decomposition && (
                      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 space-y-2 font-mono text-xs">
                        <span className="text-[10px] uppercase tracking-wider text-white/40 block">
                          SHAP FORCE ATTRIBUTION:
                        </span>
                        {msg.content.shap_decomposition.map((driver: any, dIdx: number) => (
                          <div key={dIdx} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              {driver.contribution >= 0 ? (
                                <TrendingUp className="w-3.5 h-3.5 text-[#00E599]" />
                              ) : (
                                <TrendingDown className="w-3.5 h-3.5 text-[#FF4466]" />
                              )}
                              <span className="text-white/80">{driver.feature}:</span>
                            </div>
                            <span className={driver.contribution >= 0 ? 'text-[#00E599] font-bold' : 'text-[#FF4466] font-bold'}>
                              {driver.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Data Preview Table */}
                    {renderDataPreview(msg.content.raw_data)}

                    {/* Executed SQL Trace */}
                    {msg.content.generated_sql && (
                      <div className="relative mt-2 p-3.5 rounded-xl bg-[#030507] border border-white/10 font-mono text-[11px] text-white/80 overflow-x-auto group">
                        <div className="flex items-center justify-between mb-1.5 text-[9px] uppercase tracking-widest text-white/40">
                          <div className="flex items-center gap-1.5">
                            <Code2 className="w-3 h-3 text-[#00F0FF]" />
                            <span>EXECUTED SQL TRACE:</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.content.generated_sql, idx)}
                            className="flex items-center gap-1 text-white/40 hover:text-white transition-colors cursor-pointer"
                          >
                            {copiedIndex === idx ? (
                              <>
                                <Check className="w-3 h-3 text-[#00E599]" />
                                <span className="text-[#00E599]">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy SQL</span>
                              </>
                            )}
                          </button>
                        </div>
                        <code className="text-[#00F0FF] whitespace-pre-wrap block">
                          {msg.content.generated_sql}
                        </code>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User Avatar */}
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/[0.08] border border-white/15">
                  <User className="w-4 h-4 text-white/80" />
                </div>
              )}
            </motion.div>
          ))}

          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3.5 justify-start"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#00F0FF]/15 border border-[#00F0FF]/30">
                <Bot className="w-4 h-4 text-[#00F0FF]" />
              </div>
              <div className="obsidian-panel rounded-2xl px-5 py-3.5 flex items-center gap-3 border border-white/10">
                <Loader2 className="w-4 h-4 text-[#00F0FF] animate-spin" />
                <span className="text-white/70 font-mono text-xs">
                  Routing intent & synthesizing analytical intelligence...
                </span>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 3. Terminal Prompt Input & Inspiration Chips */}
      <div className="p-4 mt-3 obsidian-panel rounded-2xl flex-shrink-0 border border-white/10 shadow-2xl">
        <div className="max-w-4xl mx-auto space-y-3">
          
          {/* Preset Inspiration Prompt Chips */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {SAMPLE_QUERIES.map((sq, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleQueryExecution(sq.question)}
                className="px-3 py-1 rounded-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-white/70 hover:text-white font-mono text-[11px] transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3 h-3 text-[#00F0FF]" />
                <span>{sq.question.length > 40 ? `${sq.question.slice(0, 40)}...` : sq.question}</span>
              </button>
            ))}
          </div>

          {/* Prompt Form */}
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <span className="absolute left-4 text-[#00F0FF] font-mono text-sm pointer-events-none font-bold">
              &gt;
            </span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything... e.g., 'What if we increase price by 15%?' or 'Explain revenue drivers'"
              className="w-full bg-[#07080B] border border-white/15 focus:border-[#00F0FF] rounded-xl py-3.5 pl-9 pr-16 font-mono text-sm text-white placeholder-white/40 focus:outline-none transition-colors shadow-inner"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="absolute right-2 px-3.5 py-1.5 rounded-lg bg-[#00F0FF] hover:bg-[#00D5E5] text-black font-mono font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer shadow-[0_0_12px_rgba(0,240,255,0.3)]"
            >
              <span>EXEC</span>
              <Send className="w-3 h-3" />
            </button>
          </form>

        </div>
      </div>

    </div>
  );
}
