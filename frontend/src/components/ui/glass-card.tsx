import { cn } from '@/lib/utils';

export interface GlassCardProps extends React.HTMLAttributes<HTMLElement> {
  /** Lift 2px and deepen the shadow on hover; press to 0.98. For clickable cards. */
  interactive?: boolean;
  /** Tighter padding for dense panels. */
  padding?: 'none' | 'sm' | 'md';
  as?: 'div' | 'section' | 'article' | 'li';
}

const paddings = { none: '', sm: 'p-4', md: 'p-4 sm:p-6' } as const;

/** The frosted-glass surface used by every card, panel and control group. */
export function GlassCard({ interactive, padding = 'md', as: Tag = 'div', className, ...rest }: GlassCardProps) {
  return (
    <Tag
      className={cn(
        'glass rounded-card',
        paddings[padding],
        interactive &&
          'transition-[transform,box-shadow,border-color] duration-[160ms] ease-[var(--ease-state)] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-card-hover active:scale-[0.98]',
        className,
      )}
      {...rest}
    />
  );
}
