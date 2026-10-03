import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  title: string;
  /** Say what is missing and what to do about it. */
  description?: string;
  icon?: React.ReactNode;
  /** The next step, usually a Button or ButtonLink. */
  action?: React.ReactNode;
  /** Draw without the surrounding card (when already inside one). */
  bare?: boolean;
  className?: string;
}

/** "Nothing here yet", with a next step. */
export function EmptyState({ title, description, icon, action, bare, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        !bare && 'glass rounded-card',
        className,
      )}
    >
      <span aria-hidden className="grid size-12 place-items-center rounded-full bg-primary-tint text-primary-ink [&>svg]:size-6">
        {icon ?? <Inbox strokeWidth={1.75} />}
      </span>
      <h2 className="t-h2">{title}</h2>
      {description && <p className="max-w-md text-sm text-ink-2">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
