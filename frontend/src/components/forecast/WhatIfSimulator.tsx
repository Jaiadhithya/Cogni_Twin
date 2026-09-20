'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  SlidersHorizontal, 
  RotateCcw, 
  Sparkles, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  CheckCircle2, 
  Layers,
  Activity,
  ShieldCheck,
  BarChart3
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { formatCurrency, formatDelta, formatDeltaPct } from '@/lib/formatters';
import { demandDeltaPct } from '@/lib/elasticity';
import type { SimulationResponse } from '@/lib/api';

interface Lever {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit: string;
  description: string;
}

const DEFAULT_LEVERS: Lever[] = [
  {
    key: 'unit_price',
    label: 'Price Elasticity',
    min: -30,
    max: 30,
    step: 1,
    defaultValue: 0,
    unit: '%',
    description: 'Dynamic price adjustment tested against demand elasticity curves.',
  },
  {
    key: 'marketing_spend',
    label: 'Demand / Marketing Spend',
    min: -50,
    max: 100,
    step: 5,
    defaultValue: 0,
    unit: '%',
    description: 'Omni-channel acquisition budget and awareness boost.',
  },
  {
    key: 'discount_rate',
    label: 'Promotional Discount Depth',
    min: -25,
    max: 25,
    step: 1,
    defaultValue: 0,
    unit: '%',
    description: 'Promotional discount rate across retail tiers.',
  },
  {
    key: 'inventory_buffer',
    label: 'Supply / Inventory Buffer',
    min: -40,
    max: 60,
    step: 5,
    defaultValue: 0,
    unit: '%',
    description: 'Safety stock depth mitigating supply-chain stockout risks.',
  }
];

interface WhatIfSimulatorProps {
  onSimulate: (mutations: Record<string, string>) => void;
  simulationResult: SimulationResponse | null;
  isSimulating: boolean;
  baselineTotal?: number;
  summary?: any;
}

export default function WhatIfSimulator({
  onSimulate,
  simulationResult,
  isSimulating,
  baselineTotal = 5482920,
  summary,
}: WhatIfSimulatorProps) {
  const [leverValues, setLeverValues] = useState<Record<string, number>>({
    unit_price: 0,
    marketing_spend: 0,
    discount_rate: 0,
    inventory_buffer: 0,
  });

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const emitMutations = useCallback((current: Record<string, number>) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const mutations: Record<string, string> = {};
      Object.entries(current).forEach(([k, v]) => {
        if (v !== 0) {
          mutations[k] = `${v >= 0 ? '+' : ''}${v}%`;
        }
      });
      onSimulate(mutations);
    }, 350);
  }, [onSimulate]);

  const handleSliderChange = (key: string, val: number) => {
    const updated = { ...leverValues, [key]: val };
    setLeverValues(updated);
    emitMutations(updated);
  };

  const handleReset = () => {
    const reset = {
      unit_price: 0,
      marketing_spend: 0,
      discount_rate: 0,
      inventory_buffer: 0,
    };
    setLeverValues(reset);
    emitMutations(reset);
  };

  const applyScenarioPreset = (preset: Record<string, number>) => {
    const updated = { ...leverValues, ...preset };
    setLeverValues(updated);
    emitMutations(updated);
  };

  // Projected impact calculation
  const calculatedImpact = useMemo(() => {
    if (simulationResult && simulationResult.total_delta !== undefined) {
      return {
        mutatedTotal: simulationResult.mutated_total || (baselineTotal + simulationResult.total_delta),
        delta: simulationResult.total_delta,
        deltaPct: simulationResult.total_delta_pct || (simulationResult.total_delta / baselineTotal * 100),
      };
    }

    // Client-side counterfactual approximation (shared elasticity model)
    const totalDeltaPct =
      demandDeltaPct('unit_price', leverValues.unit_price) +
      demandDeltaPct('marketing_spend', leverValues.marketing_spend) +
      demandDeltaPct('discount_pct', leverValues.discount_rate) +
      demandDeltaPct('inventory_buffer', leverValues.inventory_buffer);
    const delta = Math.round(baselineTotal * (totalDeltaPct / 100));
    const mutatedTotal = Math.max(0, baselineTotal + delta);

    return {
      mutatedTotal,
      delta,
      deltaPct: totalDeltaPct,
    };
  }, [simulationResult, baselineTotal, leverValues]);

  // Trajectory points for visualization
  const trajectoryData = useMemo(() => {
    if (simulationResult?.points && simulationResult.points.length > 0) {
      return simulationResult.points.slice(0, 30).map(p => ({
        date: p.date.slice(5),
        baseline: p.baseline_predicted,
        mutated: p.mutated_predicted,
      }));
    }

    // Default 30-day projection preview
    const baseDaily = baselineTotal / 30;
    const ratio = 1 + (calculatedImpact.deltaPct / 100);
    return Array.from({ length: 14 }).map((_, i) => {
      const noise = Math.sin(i * 0.8) * (baseDaily * 0.12);
      const b = Math.round(baseDaily + noise);
      return {
        date: `D+${i + 1}`,
        baseline: b,
        mutated: Math.round(b * ratio),
      };
    });
  }, [simulationResult, baselineTotal, calculatedImpact]);

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-[#06090E]/90 p-5 sm:p-6 shadow-2xl backdrop-blur-xl space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#00F0FF] shadow-[0_0_8px_#00F0FF] animate-pulse" />
            <h3 className="font-display text-lg font-bold tracking-wide text-white">
              COUNTERFACTUAL WHAT-IF SIMULATOR
            </h3>
          </div>
          <p className="text-xs font-mono text-white/50">
            Mutate policy levers and observe synthetic market response in real time
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Reset button */}
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/70 hover:text-white text-[11px] font-mono transition-all cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Levers</span>
          </button>
        </div>
      </div>

      {/* Preset Scenario Cards */}
      <div>
        <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider block mb-2">
          STRATEGIC SCENARIO PRESETS
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            onClick={() => applyScenarioPreset({ unit_price: 12, discount_rate: -10, marketing_spend: 0, inventory_buffer: 0 })}
            className="p-2.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-[#00F0FF]/10 hover:border-[#00F0FF]/30 text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-xs font-mono font-bold text-white mb-1">
              <span>Margin Defense</span>
              <ArrowUpRight className="w-3 h-3 text-[#00F0FF] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-[10px] font-mono text-white/50 leading-tight">
              +12% Price, -10% Discount
            </p>
          </button>

          <button
            onClick={() => applyScenarioPreset({ unit_price: -5, discount_rate: 15, marketing_spend: 35, inventory_buffer: 25 })}
            className="p-2.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-[#00E599]/10 hover:border-[#00E599]/30 text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-xs font-mono font-bold text-white mb-1">
              <span>Demand Surge</span>
              <ArrowUpRight className="w-3 h-3 text-[#00E599] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-[10px] font-mono text-white/50 leading-tight">
              +35% Mktg, +25% Stock, +15% Promo
            </p>
          </button>

          <button
            onClick={() => applyScenarioPreset({ unit_price: 5, discount_rate: -5, marketing_spend: 15, inventory_buffer: 10 })}
            className="p-2.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-[#FFB020]/10 hover:border-[#FFB020]/30 text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-xs font-mono font-bold text-white mb-1">
              <span>Balanced Expansion</span>
              <ArrowUpRight className="w-3 h-3 text-[#FFB020] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-[10px] font-mono text-white/50 leading-tight">
              +5% Price, +15% Mktg, +10% Stock
            </p>
          </button>
        </div>
      </div>

      {/* Main Grid: Levers on Left, Real-time Trajectory on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Levers Stack (7 cols) */}
        <div className="lg:col-span-7 space-y-4 font-mono">
          {DEFAULT_LEVERS.map((lever) => {
            const currentVal = leverValues[lever.key] ?? lever.defaultValue;
            const isNonZero = currentVal !== 0;

            return (
              <div 
                key={lever.key}
                className="p-3.5 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:border-white/15 transition-all"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <span className="text-xs font-bold text-white">{lever.label}</span>
                    <p className="text-[10px] text-white/40">{lever.description}</p>
                  </div>
                  <span className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded ${
                    currentVal > 0 
                      ? 'bg-[#00E599]/15 text-[#00E599]' 
                      : currentVal < 0 
                      ? 'bg-[#FF4466]/15 text-[#FF4466]' 
                      : 'bg-white/10 text-white/50'
                  }`}>
                    {currentVal >= 0 ? `+${currentVal}` : currentVal}{lever.unit}
                  </span>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <span className="text-[10px] text-white/30">{lever.min}%</span>
                  <input
                    type="range"
                    min={lever.min}
                    max={lever.max}
                    step={lever.step}
                    value={currentVal}
                    onChange={(e) => handleSliderChange(lever.key, parseFloat(e.target.value))}
                    className="flex-1 accent-[#00F0FF] h-1.5 bg-white/10 rounded-lg cursor-pointer appearance-none"
                  />
                  <span className="text-[10px] text-white/30">+{lever.max}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Counterfactual Projection & Metrics (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4 font-mono">
          
          {/* Outcome Metric Card */}
          <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] relative overflow-hidden">
            <div className="flex items-center justify-between text-[10px] text-white/40 uppercase tracking-wider mb-2">
              <span>PROJECTED HORIZON IMPACT</span>
              {isSimulating && (
                <span className="text-[#00F0FF] flex items-center gap-1">
                  <Activity className="w-3 h-3 animate-spin" /> SIMULATING
                </span>
              )}
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <div>
                <span className="text-2xl font-bold text-white tabular-nums tracking-tight">
                  {formatCurrency(calculatedImpact.mutatedTotal)}
                </span>
                <span className="block text-[10px] text-white/40 mt-0.5">
                  Baseline: {formatCurrency(baselineTotal)}
                </span>
              </div>

              <div className={`text-right ${calculatedImpact.delta >= 0 ? 'text-[#00E599]' : 'text-[#FF4466]'}`}>
                <span className="text-lg font-bold tabular-nums flex items-center gap-0.5 justify-end">
                  {calculatedImpact.delta >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {calculatedImpact.delta >= 0 ? '+' : ''}{calculatedImpact.deltaPct.toFixed(1)}%
                </span>
                <span className="text-[11px] tabular-nums block">
                  {formatDelta(calculatedImpact.delta)}
                </span>
              </div>
            </div>
          </div>

          {/* Mini Comparative Chart */}
          <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] h-44 w-full overflow-hidden">
            <span className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">
              BASELINE VS MUTATED TRAJECTORY
            </span>
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={trajectoryData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="simBaselineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="simMutatedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#00F0FF" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                  <XAxis dataKey="date" stroke="#ffffff30" tick={{ fill: '#ffffff50', fontSize: 9 }} tickLine={false} />
                  <YAxis stroke="#ffffff30" tick={{ fill: '#ffffff50', fontSize: 9 }} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#06090E', borderColor: '#ffffff20', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }} 
                  />
                  <Area type="monotone" dataKey="baseline" stroke="#ffffff60" strokeDasharray="3 3" fill="url(#simBaselineGrad)" strokeWidth={1.5} name="Baseline" />
                  <Area type="monotone" dataKey="mutated" stroke="#00F0FF" fill="url(#simMutatedGrad)" strokeWidth={2} name="Mutated" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
