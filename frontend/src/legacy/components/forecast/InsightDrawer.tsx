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
import { formatCurrency } from '@/legacy/lib/formatters';
import { cn } from '@/lib/utils';

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

// ─── Priority config ───────────────────────────────────────────────
const PRIORITY_CONFIG: Record<number, { icon: typeof Zap; chip: string; iconColor: string }> = {
  1: { icon: Zap, chip: 'chip--signal', iconColor: 'text-signal' },
  2: { icon: Shield, chip: '', iconColor: 'text-ink' },
  3: { icon: Clock, chip: '', iconColor: 'text-ink-muted' },
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

  const iconColor = type === 'shap' ? 'text-positive' : 'text-signal';

  // Calculate max contribution for bar scaling
  const allContributions = [
    ...positiveDrivers.map((d) => Math.abs(d.contribution)),
    ...negativeDrivers.map((d) => Math.abs(d.contribution)),
  ];
  const maxContrib = Math.max(...allContributions, 1);

  return (
    <motion.div layout className="relative overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative z-10 flex w-full items-center justify-between p-5 transition-colors duration-[var(--dur-fast)] hover:bg-graphite-750/40"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-[var(--r-sm)] border border-hairline bg-graphite-800'
            )}
          >
            {type === 'shap' ? (
              <TrendingUp className={cn('h-4 w-4', iconColor)} strokeWidth={1.5} />
            ) : (
              <Lightbulb className={cn('h-4 w-4', iconColor)} strokeWidth={1.5} />
            )}
          </span>
          <div className="text-left">
            <h3 className="text-h3 text-ink">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {anomalyDetected && type === 'prescriptive' && (
            <span className="chip chip--signal">
              <AlertTriangle className="h-3 w-3" />
              Anomaly
            </span>
          )}
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="text-ink-muted"
          >
            <ChevronDown className="h-4 w-4" />
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
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="relative z-10 px-5 pb-5">
              <div className="rule-gradient mb-5" />

              {/* SHAP drivers */}
              {type === 'shap' && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <h4 className="border-b border-hairline pb-2 text-caption text-positive">
                      Positive forces
                    </h4>
                    {positiveDrivers.map((driver, idx) => (
                      <motion.div
                        key={`pos-${idx}`}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.08, duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                        className="space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-3.5 w-3.5 text-positive" strokeWidth={1.5} />
                            <span className="text-xs font-medium capitalize text-ink">
                              {driver.feature.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <span className="font-mono text-xs font-semibold tabular-nums text-positive">
                            +{formatDynamic(Math.abs(driver.contribution))}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-[var(--r-pill)] bg-graphite-800">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(Math.abs(driver.contribution) / maxContrib) * 100}%` }}
                            transition={{ duration: 0.7, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full rounded-[var(--r-pill)] bg-positive"
                          />
                        </div>
                        <p className="text-[11px] leading-relaxed text-ink-muted">
                          {driver.description}
                        </p>
                      </motion.div>
                    ))}
                    {positiveDrivers.length === 0 && (
                      <p className="text-xs text-ink-muted">No significant positive forces detected.</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="border-b border-hairline pb-2 text-caption text-negative">
                      Negative forces
                    </h4>
                    {negativeDrivers.map((driver, idx) => (
                      <motion.div
                        key={`neg-${idx}`}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.08, duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                        className="space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TrendingDown className="h-3.5 w-3.5 text-negative" strokeWidth={1.5} />
                            <span className="text-xs font-medium capitalize text-ink">
                              {driver.feature.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <span className="font-mono text-xs font-semibold tabular-nums text-negative">
                            −{formatDynamic(Math.abs(driver.contribution))}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-[var(--r-pill)] bg-graphite-800">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(Math.abs(driver.contribution) / maxContrib) * 100}%` }}
                            transition={{ duration: 0.7, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full rounded-[var(--r-pill)] bg-negative"
                          />
                        </div>
                        <p className="text-[11px] leading-relaxed text-ink-muted">
                          {driver.description}
                        </p>
                      </motion.div>
                    ))}
                    {negativeDrivers.length === 0 && (
                      <p className="text-xs text-ink-muted">No significant negative forces detected.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Prescriptive actions */}
              {type === 'prescriptive' && (
                <div className="space-y-5">
                  {anomalyDetected && anomalyDescription && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="panel-signal flex items-start gap-3 p-4"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-signal" strokeWidth={1.5} />
                      <p className="text-sm leading-relaxed text-ink">{anomalyDescription}</p>
                    </motion.div>
                  )}

                  {executiveSummary && (
                    <div className="panel-inset p-4">
                      <p className="whitespace-pre-line text-sm leading-relaxed text-ink-secondary">
                        {executiveSummary}
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {actions.length === 0 ? (
                      <div className="panel-inset flex items-start gap-3 p-4">
                        <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-muted" strokeWidth={1.5} />
                        <div>
                          <p className="text-sm leading-relaxed text-ink-secondary">
                            Prescriptive actions are currently unavailable.
                          </p>
                          <p className="mt-1 text-xs text-ink-muted">
                            The analysis engine could not generate recommendations for this dataset. If an anomaly is
                            flagged above, treat it as requiring manual review rather than a clean bill of health.
                          </p>
                        </div>
                      </div>
                    ) : actions.map((action, idx) => {
                      const config = PRIORITY_CONFIG[action.priority] || PRIORITY_CONFIG[3];
                      const PriorityIcon = config.icon;

                      return (
                        <motion.div
                          key={`action-${idx}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                          className="panel-inset space-y-2 p-4"
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[var(--r-xs)] border border-hairline bg-graphite-800">
                              <PriorityIcon className={cn('h-3.5 w-3.5', config.iconColor)} strokeWidth={1.5} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-center gap-2">
                                <span className="text-caption text-signal">Priority {action.priority}</span>
                                <span className="text-ink-muted">·</span>
                                <span className="text-caption">{action.timeframe}</span>
                              </div>
                              <p className="text-sm leading-relaxed text-ink">{action.action}</p>
                              <p className="mt-1.5 text-xs text-ink-muted">
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
