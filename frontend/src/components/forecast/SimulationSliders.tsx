'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, RotateCcw, Sparkles, Zap, ShieldAlert, ArrowUpRight } from 'lucide-react';

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
    const defaultCols = ['unit_price', 'discount_rate', 'marketing_spend', 'inventory_depth', 'shipping_latency'];
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

  const emitMutations = useCallback((currentVals: Record<string, number>) => {
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
  }, [dynamicSliders, onMutationsChange]);

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
    const defaults = Object.fromEntries(
      dynamicSliders.map((s) => [s.key, s.defaultValue])
    );
    setValues(defaults);
    onMutationsChange({});
  }, [onMutationsChange, dynamicSliders]);

  const hasChanges = dynamicSliders.some((s) => values[s.key] && values[s.key] !== s.defaultValue);

  if (dynamicSliders.length === 0) return null;

  return (
    <div className="obsidian-panel rounded-xl overflow-hidden shadow-2xl border border-white/10">
      
      {/* Header / Accordion Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors cursor-pointer border-b border-white/[0.06]"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#FFB020]/10 border border-[#FFB020]/25">
            <SlidersHorizontal className="w-4 h-4 text-[#FFB020]" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-display font-semibold text-white flex items-center gap-2">
              What-If Counterfactual Levers
            </h3>
            <p className="text-[11px] font-mono text-white/50 mt-0.5">
              Instant tensor propagation & sensitivity simulation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isSimulating && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00F0FF]/15 border border-[#00F0FF]/30 font-mono"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-pulse" />
              <span className="text-[10px] text-[#00F0FF] uppercase tracking-wider font-semibold">
                Simulating
              </span>
            </motion.div>
          )}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="text-white/40"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.div>
        </div>
      </button>

      {/* Preset Scenario Quick-Chips */}
      <div className="p-4 bg-white/[0.02] border-b border-white/[0.06] flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 mr-1">
          Scenarios:
        </span>
        <button
          type="button"
          onClick={() => applyPreset({ unit_price: 15, marketing_spend: 20, discount_rate: -10 })}
          className="px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-[#00E599]/15 border border-white/10 hover:border-[#00E599]/40 text-white/70 hover:text-[#00E599] font-mono text-[11px] transition-all flex items-center gap-1 cursor-pointer"
        >
          <Zap className="w-3 h-3 text-[#00E599]" />
          <span>Expansion (+15% Price)</span>
        </button>
        <button
          type="button"
          onClick={() => applyPreset({ unit_price: -10, shipping_latency: 25, inventory_depth: -20 })}
          className="px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-[#FF4466]/15 border border-white/10 hover:border-[#FF4466]/40 text-white/70 hover:text-[#FF4466] font-mono text-[11px] transition-all flex items-center gap-1 cursor-pointer"
        >
          <ShieldAlert className="w-3 h-3 text-[#FF4466]" />
          <span>Supply Shock Test</span>
        </button>
        <button
          type="button"
          onClick={() => applyPreset({ unit_price: 8, discount_rate: -15 })}
          className="px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-[#00F0FF]/15 border border-white/10 hover:border-[#00F0FF]/40 text-white/70 hover:text-[#00F0FF] font-mono text-[11px] transition-all flex items-center gap-1 cursor-pointer"
        >
          <Sparkles className="w-3 h-3 text-[#00F0FF]" />
          <span>Margin Shield</span>
        </button>
      </div>

      {/* Slider Controls List */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden p-5 space-y-5"
          >
            {dynamicSliders.map((slider) => {
              const val = values[slider.key] ?? slider.defaultValue;
              const isChanged = val !== slider.defaultValue;
              const pct = ((val - slider.min) / (slider.max - slider.min)) * 100;

              return (
                <div key={slider.key} className="space-y-1.5 font-mono">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/70 uppercase tracking-wider text-[11px]">
                      {slider.label}
                    </span>
                    <span
                      className={`font-bold tabular-nums text-xs px-2 py-0.5 rounded ${
                        isChanged
                          ? val > 0
                            ? 'bg-[#00E599]/15 text-[#00E599] border border-[#00E599]/30'
                            : 'bg-[#FF4466]/15 text-[#FF4466] border border-[#FF4466]/30'
                          : 'text-white/40'
                      }`}
                    >
                      {slider.formatValue(val)}
                    </span>
                  </div>

                  {/* Range Track */}
                  <div className="relative h-6 flex items-center">
                    <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/10" />
                    <div
                      className="absolute h-1.5 rounded-full"
                      style={{
                        left: val >= 0 ? '50%' : `${pct}%`,
                        width: `${Math.abs(val) * 1.25}%`,
                        backgroundColor: val >= 0 ? '#00E599' : '#FF4466',
                        boxShadow: `0 0 10px ${val >= 0 ? 'rgba(0,229,153,0.5)' : 'rgba(255,68,102,0.5)'}`,
                      }}
                    />
                    {/* Zero Anchor */}
                    <div className="absolute left-1/2 -translate-x-1/2 w-0.5 h-3 bg-white/30" />

                    <input
                      type="range"
                      min={slider.min}
                      max={slider.max}
                      step={slider.step}
                      value={val}
                      onChange={(e) => handleSliderChange(slider.key, Number(e.target.value))}
                      disabled={disabled}
                      className="w-full relative z-10 opacity-0 cursor-pointer h-6"
                    />

                    {/* Indicator Thumb */}
                    <div
                      className={`absolute w-4 h-4 rounded-full border-2 pointer-events-none transition-transform ${
                        isChanged
                          ? val > 0
                            ? 'bg-[#00E599] border-white shadow-[0_0_12px_#00E599]'
                            : 'bg-[#FF4466] border-white shadow-[0_0_12px_#FF4466]'
                          : 'bg-white border-white/60'
                      }`}
                      style={{ left: `calc(${pct}% - 8px)` }}
                    />
                  </div>

                  <div className="flex justify-between text-[9px] text-white/30">
                    <span>{slider.min}%</span>
                    <span>Baseline (0%)</span>
                    <span>+{slider.max}%</span>
                  </div>
                </div>
              );
            })}

            {/* Reset Levers Button */}
            {hasChanges && (
              <button
                type="button"
                onClick={handleReset}
                className="w-full mt-2 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/60 hover:text-white font-mono text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All Scenario Levers</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
