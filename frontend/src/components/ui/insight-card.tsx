import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InsightCardProps {
  title: string;
  /** Small caption, e.g. "AI-generated". */
  eyebrow?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Purple card for anything the model said: insights, recommendations, AI answers.
 * Purple is reserved for AI-generated content so users learn "purple = the model said this".
 */
export function InsightCard({ title, eyebrow = 'AI insight', className, children }: InsightCardProps) {
  return (
    <section
      aria-label={title}
      className={cn('glass rounded-card border-accent/20 bg-accent-tint p-4 sm:p-6', className)}
    >
      <div className="flex items-center gap-2 text-accent-ink">
        <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />
        <span className="text-xs font-semibold uppercase tracking-[0.06em]">{eyebrow}</span>
      </div>
      <h2 className="t-h2 mt-2">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] text-ink-2">{children}</div>
    </section>
  );
}
