'use client';

import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { formatCurrency, formatCurrencyCompact, formatDelta, formatDeltaPct } from '@/lib/formatters';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type KpiCardProps = {
  title: string;
  value: number;
  format?: 'currency' | 'compact' | 'number' | 'percent';
  delta?: number;
  deltaPct?: number;
  icon: LucideIcon;
  loading?: boolean;
  className?: string;
};

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

function AnimatedNumber({ value, format }: { value: number; format: string }) {
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { duration: 900, bounce: 0 });
  const displayValue = useTransform(springValue, (current) => formatByType(current, format));

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  return <motion.span>{displayValue}</motion.span>;
}

export function KpiCard({
  title,
  value,
  format = 'compact',
  delta,
  deltaPct,
  icon: Icon,
  loading = false,
  className,
}: KpiCardProps) {
  const positive = (delta ?? 0) >= 0;

  return (
    <div
      className={cn(
        'panel relative flex h-full min-h-[118px] flex-col justify-between overflow-hidden p-5',
        className
      )}
    >
      {/* Label + icon */}
      <div className="relative z-10 flex items-center justify-between">
        <span className="text-caption">{title}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-[var(--r-xs)] border border-hairline bg-graphite-800">
          <Icon className="h-3.5 w-3.5 text-signal" strokeWidth={1.5} />
        </span>
      </div>

      {/* Value + delta */}
      <div className="relative z-10">
        {loading ? (
          <div className="h-7 w-28 animate-pulse rounded-[var(--r-xs)] bg-graphite-700/50" />
        ) : (
          <div className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-ink">
            <AnimatedNumber value={value} format={format} />
          </div>
        )}

        {delta !== undefined && !loading && (
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={cn(
                'font-mono text-xs font-semibold tabular-nums',
                positive ? 'text-positive' : 'text-negative'
              )}
            >
              {formatDelta(delta)}
            </span>
            {deltaPct !== undefined && (
              <span
                className={cn(
                  'font-mono text-[10px] font-medium tabular-nums',
                  positive ? 'text-positive' : 'text-negative'
                )}
              >
                {formatDeltaPct(deltaPct)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default KpiCard;
