import { cn } from '@/lib/utils';
import { GlassCard } from './glass-card';

export interface ChartCardProps {
  title: string;
  description?: string;
  /** Right-aligned controls, e.g. a PeriodPicker. */
  actions?: React.ReactNode;
  /**
   * Plain-language summary of what the chart shows. Read by screen readers in place of
   * the SVG, e.g. "Daily revenue rose 12% over the last 30 days, peaking at ₹2.4 L on 12 Mar."
   */
  summary: string;
  /** Chart area height in px. */
  height?: number;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Card chrome for any chart: title, description, controls, accessible summary. */
export function ChartCard({ title, description, actions, summary, height = 280, footer, className, children }: ChartCardProps) {
  return (
    <GlassCard as="section" aria-label={title} className={cn('flex flex-col', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="t-h2">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>
      <figure className="mt-5 w-full" style={{ height }} role="img" aria-label={summary}>
        {children}
        <figcaption className="sr-only">{summary}</figcaption>
      </figure>
      {footer && <div className="mt-4 border-t border-border pt-4 text-sm text-ink-3">{footer}</div>}
    </GlassCard>
  );
}
