import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSignedPercent, trendOf, type Trend } from '@/lib/formatters';

const styles: Record<Trend, string> = {
  up: 'bg-positive-tint text-positive',
  down: 'bg-negative-tint text-negative',
  flat: 'bg-black/5 text-ink-2',
};

const icons = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus } as const;

export interface ChangeBadgeProps {
  /** Change in percent units (14.2 = +14.2%). */
  value: number;
  /** Set when a rise is bad (e.g. cost): flips green and red. */
  invert?: boolean;
  /** Override the text, e.g. "₹12,000". */
  label?: string;
  className?: string;
}

/** Tinted pill for a change. Green means good, red means bad: never decoration. */
export function ChangeBadge({ value, invert = false, label, className }: ChangeBadgeProps) {
  const trend = trendOf(value);
  const tone: Trend = trend === 'flat' ? 'flat' : invert ? (trend === 'up' ? 'down' : 'up') : trend;
  const Icon = icons[trend];
  const text = label ?? formatSignedPercent(value);
  return (
    <span
      className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', styles[tone], className)}
    >
      <Icon aria-hidden className="size-3" strokeWidth={2} />
      <span>{text}</span>
      <span className="sr-only">{trend === 'up' ? ' increase' : trend === 'down' ? ' decrease' : ' no change'}</span>
    </span>
  );
}
