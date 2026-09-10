'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Lightbulb,
  ChevronDown,
  AlertTriangle,
  Zap,
  Shield,
  Clock,
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

// ─── Types ─────────────────────────────────────────────────────────
interface ShapDriver {
  feature: string;
  contribution: number;
  description: string;
}

interface PrescriptiveAction {
  priority: number;
  action: string;
  expected_impact: string;
  timeframe: string;
}

interface InsightDrawerProps {
  type: 'shap' | 'prescriptive';
  title: string;
  subtitle?: string;
  // SHAP props
  positiveDrivers?: ShapDriver[];
  negativeDrivers?: ShapDriver[];
  // Prescriptive props
  actions?: PrescriptiveAction[];
  executiveSummary?: string;
  anomalyDetected?: boolean;
  anomalyDescription?: string;
  // State
  defaultOpen?: boolean;
  summary?: any;
}

// ─── Priority Icons ────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<number, { icon: typeof Zap; color: string; bg: string }> = {
  1: { icon: Zap, color: 'text-[#FFB020]', bg: 'bg-[#FFB020]/10 border-[#FFB020]/25' },
  2: { icon: Shield, color: 'text-[#00F0FF]', bg: 'bg-[#00F0FF]/10 border-[#00F0FF]/25' },
  3: { icon: Clock, color: 'text-white/40', bg: 'bg-white/[0.04] border-white/10' },
};

// ─── Component ─────────────────────────────────────────────────────
export default function InsightDrawer({
  type,
  title,
  subtitle,
  positiveDrivers = [],
  negativeDrivers = [],
  actions = [],
  executiveSummary,
  anomalyDetected = false,
  anomalyDescription,
  defaultOpen = false,
  summary,
}: InsightDrawerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const targetMetric = summary?.metadata?.target_metric || '';
  const isCurrency = /price|sales|revenue/i.test(targetMetric);
  const formatDynamic = (val: number) => {
    if (isCurrency) return formatCurrency(val);
    return new Intl.NumberFormat('en-US').format(val);
  };

  const iconBg =
    type === 'shap'
      ? 'bg-[#00F0FF]/10 border-[#00F0FF]/25'
      : 'bg-[#FFB020]/10 border-[#FFB020]/25';
  const iconColor = type === 'shap' ? 'text-[#00F0FF]' : 'text-[#FFB020]';

  // Calculate max contribution for bar scaling
  const allContributions = [
    ...positiveDrivers.map((d) => Math.abs(d.contribution)),
    ...negativeDrivers.map((d) => Math.abs(d.contribution)),
  ];
  const maxContrib = Math.max(...allContributions, 1);

  return (
    <motion.div
      layout
      className="relative overflow-hidden rounded-xl obsidian-panel"
    >
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative z-10 w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center justify-center w-9 h-9 rounded-xl ${iconBg} border`}
          >
            {type === 'shap' ? (
              <TrendingUp className={`w-4 h-4 ${iconColor}`} />
            ) : (
              <Lightbulb className={`w-4 h-4 ${iconColor}`} />
            )}
          </div>
          <div className="text-left">
            <h3 className="text-sm font-display font-semibold text-white tracking-wide">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[11px] font-mono text-white/50 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {anomalyDetected && type === 'prescriptive' && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] text-amber-400 uppercase tracking-widest font-medium">
                Anomaly
              </span>
            </span>
          )}
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
          </motion.div>
        </div>
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="relative z-10 px-5 pb-5">
              <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent mb-5" />

              {/* SHAP Drivers View */}
              {type === 'shap' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Positive Drivers */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] uppercase tracking-[0.15em] text-emerald-500/70 font-medium border-b border-white/[0.04] pb-2">
                      Positive Forces
                    </h4>
                    {positiveDrivers.map((driver, idx) => (
                      <motion.div
                        key={`pos-${idx}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-xs text-[var(--text-primary)] font-medium capitalize">
                              {driver.feature.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-emerald-400 tabular-nums">
                            +{formatDynamic(Math.abs(driver.contribution))}
                          </span>
                        </div>
                        {/* Animated Bar */}
                        <div className="h-1.5 rounded-full bg-white/[0.03] overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{
                              width: `${(Math.abs(driver.contribution) / maxContrib) * 100}%`,
                            }}
                            transition={{
                              duration: 0.8,
                              delay: idx * 0.1,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                          />
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {driver.description}
                        </p>
                      </motion.div>
                    ))}
                    {positiveDrivers.length === 0 && (
                      <p className="text-xs text-[var(--text-secondary)] italic">
                        No significant positive forces detected
                      </p>
                    )}
                  </div>

                  {/* Negative Drivers */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] uppercase tracking-[0.15em] text-rose-500/70 font-medium border-b border-white/[0.04] pb-2">
                      Negative Forces
                    </h4>
                    {negativeDrivers.map((driver, idx) => (
                      <motion.div
                        key={`neg-${idx}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                            <span className="text-xs text-[var(--text-primary)] font-medium capitalize">
                              {driver.feature.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-rose-400 tabular-nums">
                            -{formatDynamic(Math.abs(driver.contribution))}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/[0.03] overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{
                              width: `${(Math.abs(driver.contribution) / maxContrib) * 100}%`,
                            }}
                            transition={{
                              duration: 0.8,
                              delay: idx * 0.1,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            className="h-full rounded-full bg-gradient-to-r from-rose-600 to-rose-400"
                          />
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {driver.description}
                        </p>
                      </motion.div>
                    ))}
                    {negativeDrivers.length === 0 && (
                      <p className="text-xs text-[var(--text-secondary)] italic">
                        No significant negative forces detected
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Prescriptive Actions View */}
              {type === 'prescriptive' && (
                <div className="space-y-5">
                  {/* Anomaly Alert */}
                  {anomalyDetected && anomalyDescription && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10"
                    >
                      <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-500/90 leading-relaxed">
                        {anomalyDescription}
                      </p>
                    </motion.div>
                  )}

                  {/* Executive Summary */}
                  {executiveSummary && (
                    <div className="p-4 rounded-xl glass-panel">
                      <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-line">
                        {executiveSummary}
                      </p>
                    </div>
                  )}

                  {/* Action Cards */}
                  <div className="space-y-3">
                    {actions.map((action, idx) => {
                      const config = PRIORITY_CONFIG[action.priority] || PRIORITY_CONFIG[3];
                      const PriorityIcon = config.icon;

                      return (
                        <motion.div
                          key={`action-${idx}`}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: idx * 0.15,
                            type: 'spring',
                            stiffness: 300,
                            damping: 30,
                          }}
                          className={`p-4 rounded-xl border ${config.bg} space-y-2`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] flex-shrink-0">
                              <PriorityIcon className={`w-4 h-4 ${config.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] uppercase tracking-widest font-bold ${config.color}`}>
                                  Priority {action.priority}
                                </span>
                                <span className="text-[10px] text-[var(--text-secondary)]">•</span>
                                <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
                                  {action.timeframe}
                                </span>
                              </div>
                              <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                                {action.action}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] mt-1.5">
                                Expected: {action.expected_impact}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
