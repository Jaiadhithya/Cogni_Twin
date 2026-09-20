'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, RotateCcw, Sparkles, Zap, ShieldAlert, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SliderConfig {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  defaultValue: number;
  formatValue: (v: number) => string;
  toMutation: (v: number) => string;
}

interface SimulationSlidersProps {
  onMutationsChange: (mutations: Record<string, string>) => void;
  isSimulating: boolean;
  disabled?: boolean;
  summary?: any;
}

export default function SimulationSliders({
  onMutationsChange,
  isSimulating,
  disabled = false,
  summary,
}: SimulationSlidersProps) {
  const dynamicSliders: SliderConfig[] = useMemo(() => {
    const defaultCols = [
      'unit_price',
      'discount_rate',
      'marketing_spend',
      'inventory_depth',
      'shipping_latency',
    ];
    const numCols = summary?.metadata?.numerical_columns || defaultCols;
    const targetMetric = summary?.metadata?.target_metric || 'revenue';

    return numCols
      .filter((col: string) => col !== targetMetric)
      .slice(0, 5)
      .map((col: string) => ({
        key: col,
        label: col.replace(/_/g, ' '),
        min: -40,
        max: 40,
        step: 1,
        unit: '%',
        defaultValue: 0,
        formatValue: (v: number) => `${v >= 0 ? '+' : ''}${v}%`,
        toMutation: (v: number) => `${v >= 0 ? '+' : ''}${v}%`,
      }));
  }, [summary]);

  const [values, setValues] = useState<Record<string, number>>({});
  const [isExpanded, setIsExpanded] = useState(true);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setValues((prev) => {
      const newValues = { ...prev };
      let changed = false;
      dynamicSliders.forEach((s) => {
        if (newValues[s.key] === undefined) {
          newValues[s.key] = s.defaultValue;
          changed = true;
        }
      });
      return changed ? newValues : prev;
    });
  }, [dynamicSliders]);

  const emitMutations = useCallback(
    (currentVals: Record<string, number>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const mutations: Record<string, string> = {};
        for (const slider of dynamicSliders) {
          if (currentVals[slider.key] !== undefined && currentVals[slider.key] !== slider.defaultValue) {
            mutations[slider.key] = slider.toMutation(currentVals[slider.key]);
          }
        }
        onMutationsChange(mutations);
      }, 350);
    },
    [dynamicSliders, onMutationsChange]
  );

  const handleSliderChange = useCallback(
    (key: string, newValue: number) => {
      const updated = { ...values, [key]: newValue };
      setValues(updated);
      emitMutations(updated);
    },
    [values, emitMutations]
  );

  const applyPreset = (presetMutations: Record<string, number>) => {
    const updated = { ...values };
    dynamicSliders.forEach((s) => {
      updated[s.key] = presetMutations[s.key] ?? s.defaultValue;
    });
    setValues(updated);
    emitMutations(updated);
  };

  const handleReset = useCallback(() => {
    const defaults = Object.fromEntries(dynamicSliders.map((s) => [s.key, s.defaultValue]));
    setValues(defaults);
    onMutationsChange({});
  }, [onMutationsChange, dynamicSliders]);

  const hasChanges = dynamicSliders.some((s) => values[s.key] && values[s.key] !== s.defaultValue);

  if (dynamicSliders.length === 0) return null;

  return (
    <div className="panel overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between border-b border-hairline p-5 transition-colors duration-[var(--dur-fast)] hover:bg-graphite-750/40"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] border border-hairline bg-graphite-800">
            <SlidersHorizontal className="h-4 w-4 text-signal" strokeWidth={1.5} />
          </span>
          <div className="text-left">
            <h3 className="text-h3 text-ink">What-if counterfactual levers</h3>
            <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
              Sensitivity simulation with live propagation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isSimulating && (
            <motion.span
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="chip chip--signal"
            >
              <span className="status-dot status-dot--signal breathe" aria-hidden="true" />
              Simulating
            </motion.span>
          )}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="text-ink-muted"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </div>
      </button>

      {/* Preset scenarios */}
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline bg-graphite-900/50 p-4">
        <span className="mr-1 text-caption">Scenarios</span>
        <button
          type="button"
          onClick={() => applyPreset({ unit_price: 15, marketing_spend: 20, discount_rate: -10 })}
          className="chip transition-colors duration-[var(--dur-fast)] hover:border-hairline-signal hover:text-signal"
        >
          <Zap className="h-3 w-3" />
          Expansion
        </button>
        <button
          type="button"
          onClick={() => applyPreset({ unit_price: -10, shipping_latency: 25, inventory_depth: -20 })}
          className="chip transition-colors duration-[var(--dur-fast)] hover:border-hairline-signal hover:text-signal"
        >
          <ShieldAlert className="h-3 w-3" />
          Supply shock
        </button>
        <button
          type="button"
          onClick={() => applyPreset({ unit_price: 8, discount_rate: -15 })}
          className="chip transition-colors duration-[var(--dur-fast)] hover:border-hairline-signal hover:text-signal"
        >
          <Sparkles className="h-3 w-3" />
          Margin shield
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-5 overflow-hidden p-5"
          >
            {dynamicSliders.map((slider) => {
              const val = values[slider.key] ?? slider.defaultValue;
              const isChanged = val !== slider.defaultValue;
              const pct = ((val - slider.min) / (slider.max - slider.min)) * 100;

              return (
                <div key={slider.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ink-secondary">{slider.label}</span>
                    <span
                      className={cn(
                        'rounded-[var(--r-xs)] px-2 py-0.5 font-mono text-xs font-semibold tabular-nums',
                        isChanged
                          ? val > 0
                            ? 'bg-positive/10 text-positive'
                            : 'bg-negative/10 text-negative'
                          : 'text-ink-muted'
                      )}
                    >
                      {slider.formatValue(val)}
                    </span>
                  </div>

                  <div className="relative flex h-6 items-center">
                    <div className="absolute inset-x-0 h-1.5 rounded-[var(--r-pill)] bg-graphite-800" />
                    <div
                      className="absolute h-1.5 rounded-[var(--r-pill)] bg-signal"
                      style={{
                        left: val >= 0 ? '50%' : `${pct}%`,
                        width: `${Math.abs(val) * 1.25}%`,
                      }}
                    />
                    {/* Zero anchor */}
                    <div
                      className="absolute left-1/2 h-3 w-0.5 -translate-x-1/2 bg-ink-muted/50"
                      aria-hidden="true"
                    />

                    <input
                      type="range"
                      min={slider.min}
                      max={slider.max}
                      step={slider.step}
                      value={val}
                      onChange={(e) => handleSliderChange(slider.key, Number(e.target.value))}
                      disabled={disabled}
                      aria-label={slider.label}
                      aria-valuetext={slider.formatValue(val)}
                      className="relative z-10 h-6 w-full cursor-pointer opacity-0"
                    />

                    {/* Thumb indicator */}
                    <div
                      className={cn(
                        'pointer-events-none absolute h-4 w-4 rounded-full border-2 transition-colors',
                        isChanged
                          ? val > 0
                            ? 'border-positive bg-positive'
                            : 'border-negative bg-negative'
                          : 'border-ink-muted bg-graphite-600'
                      )}
                      style={{ left: `calc(${pct}% - 8px)` }}
                      aria-hidden="true"
                    />
                  </div>

                  <div className="flex justify-between font-mono text-[10px] text-ink-muted">
                    <span>{slider.min}%</span>
                    <span>Baseline</span>
                    <span>+{slider.max}%</span>
                  </div>
                </div>
              );
            })}

            {hasChanges && (
              <button
                type="button"
                onClick={handleReset}
                className="btn btn-secondary mt-2 w-full"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset all levers
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
