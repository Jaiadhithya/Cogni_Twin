'use client';

import { cn } from '@/lib/utils';
import { ChangeBadge } from './change-badge';
import { CountUp } from './count-up';
import { GlassCard } from './glass-card';

export interface KpiCardProps {
  /** Small grey label above the number. */
  label: string;
  value: number;
  /** Formats the number, e.g. formatInrCompact. Also used mid-tween. */
  format?: (value: number) => string;
  /** Change vs the previous period, in percent units. */
  change?: number;
  /** Replaces the badge text, e.g. "₹12,000". */
  changeLabel?: string;
  /** Flip green/red for metrics where a rise is bad. */
  invertChange?: boolean;
  /** Small caption under the badge, e.g. "vs previous 30 days". */
  hint?: string;
  icon?: React.ReactNode;
  className?: string;
}

/** Small grey label → big number → small tinted change badge. */
export function KpiCard({ label, value, format, change, changeLabel, invertChange, hint, icon, className }: KpiCardProps) {
  return (
    <GlassCard as="article" aria-label={label} className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="t-label">{label}</p>
        {icon && (
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-control bg-primary-tint text-primary-ink [&>svg]:size-[18px]">
            {icon}
          </span>
        )}
      </div>
      <p className="t-kpi">
        <CountUp value={value} format={format} />
      </p>
      {(change !== undefined || hint) && (
        <div className="flex flex-wrap items-center gap-2">
          {change !== undefined && <ChangeBadge value={change} label={changeLabel} invert={invertChange} />}
          {hint && <span className="text-xs text-ink-3">{hint}</span>}
        </div>
      )}
    </GlassCard>
  );
}
