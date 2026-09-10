'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency, formatCurrencyCompact, formatDelta, formatDeltaPct } from '@/lib/formatters';
import { LucideIcon } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────
interface GlassKPICardProps {
  title: string;
  value: number;
  format?: 'currency' | 'compact' | 'number' | 'percent';
  delta?: number;
  deltaPct?: number;
  icon: LucideIcon;
  accentColor: string; // Tailwind color class like 'indigo' | 'emerald' | 'amber' | 'rose'
  loading?: boolean;
}

import { useMotionValue, useSpring, useTransform } from 'framer-motion';

function AnimatedNumber({ value, format }: { value: number; format: string }) {
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { duration: 1500, bounce: 0 });
  const displayValue = useTransform(springValue, (current) => formatByType(current, format));

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  return <motion.span>{displayValue}</motion.span>;
}

// ─── Color Maps ────────────────────────────────────────────────────
const ACCENT_STYLES: Record<string, { bg: string; text: string; glow: string; border: string }> = {
  cyan: {
    bg: 'bg-[#00F0FF]/10',
    text: 'text-[#00F0FF]',
    glow: 'shadow-[0_0_20px_rgba(0,240,255,0.18)]',
    border: 'border-[#00F0FF]/25',
  },
  blue: {
    bg: 'bg-[#00F0FF]/10',
    text: 'text-[#00F0FF]',
    glow: 'shadow-[0_0_20px_rgba(0,240,255,0.18)]',
    border: 'border-[#00F0FF]/25',
  },
  amber: {
    bg: 'bg-[#FFB020]/10',
    text: 'text-[#FFB020]',
    glow: 'shadow-[0_0_20px_rgba(255,176,32,0.18)]',
    border: 'border-[#FFB020]/25',
  },
  emerald: {
    bg: 'bg-[#00E599]/10',
    text: 'text-[#00E599]',
    glow: 'shadow-[0_0_20px_rgba(0,229,153,0.18)]',
    border: 'border-[#00E599]/25',
  },
  coral: {
    bg: 'bg-[#FF4466]/10',
    text: 'text-[#FF4466]',
    glow: 'shadow-[0_0_20px_rgba(255,68,102,0.18)]',
    border: 'border-[#FF4466]/25',
  },
  rose: {
    bg: 'bg-[#FF4466]/10',
    text: 'text-[#FF4466]',
    glow: 'shadow-[0_0_20px_rgba(255,68,102,0.18)]',
    border: 'border-[#FF4466]/25',
  },
  indigo: {
    bg: 'bg-[#00F0FF]/10',
    text: 'text-[#00F0FF]',
    glow: 'shadow-[0_0_20px_rgba(0,240,255,0.18)]',
    border: 'border-[#00F0FF]/25',
  },
  purple: {
    bg: 'bg-[#00F0FF]/10',
    text: 'text-[#00F0FF]',
    glow: 'shadow-[0_0_20px_rgba(0,240,255,0.18)]',
    border: 'border-[#00F0FF]/25',
  },
};

// ─── Format Value ──────────────────────────────────────────────────
function formatByType(value: number, format: string): string {
  switch (format) {
    case 'currency':
      return formatCurrency(value);
    case 'compact':
      return formatCurrencyCompact(value);
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'number':
    default:
      return value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }
}

// ─── Component ─────────────────────────────────────────────────────
export default function GlassKPICard({
  title,
  value,
  format = 'compact',
  delta,
  deltaPct,
  icon: Icon,
  accentColor,
  loading = false,
}: GlassKPICardProps) {
  const styles = ACCENT_STYLES[accentColor] || ACCENT_STYLES.indigo;

  return (
    <motion.div
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={`
        relative overflow-hidden rounded-xl
        obsidian-panel ${styles.glow}
        p-5 flex flex-col justify-between min-h-[120px]
        transition-all duration-300
      `}
    >

      {/* Subtle Gradient Accent */}
      <div
        className={`absolute -top-12 -right-12 w-24 h-24 rounded-full ${styles.bg} blur-2xl opacity-40`}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-3">
        <span className="text-[11px] font-mono uppercase tracking-wider text-white/50">
          {title}
        </span>
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-lg ${styles.bg} border ${styles.border}`}
        >
          <Icon className={`w-4 h-4 ${styles.text}`} />
        </div>
      </div>

      {/* Value */}
      <div className="relative z-10">
        {loading ? (
          <div className="h-8 w-32 bg-white/[0.04] rounded-lg animate-pulse" />
        ) : (
          <h3 className="text-2xl font-bold font-mono text-white tracking-tight tabular-nums">
            <AnimatedNumber value={value} format={format} />
          </h3>
        )}

        {/* Delta */}
        {delta !== undefined && !loading && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <span
              className={`text-xs font-semibold tabular-nums ${
                delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatDelta(delta)}
            </span>
            {deltaPct !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  deltaPct >= 0
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-rose-500/10 text-rose-400'
                }`}
              >
                {formatDeltaPct(deltaPct)}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
