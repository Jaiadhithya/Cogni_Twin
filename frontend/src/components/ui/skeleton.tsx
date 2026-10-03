import { cn } from '@/lib/utils';

/** A soft shimmering placeholder block (transform-only shimmer, 1.6s). */
export function Skeleton({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('skeleton', className)} {...rest} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden className={cn('space-y-2.5', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/** Same footprint as KpiCard. */
export function KpiSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('glass rounded-card p-4 sm:p-6', className)}>
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="mt-4 h-8 w-36" />
      <Skeleton className="mt-4 h-5 w-16 rounded-full" />
    </div>
  );
}

/** Same footprint as ChartCard. */
export function ChartSkeleton({ className, height = 280 }: { className?: string; height?: number }) {
  return (
    <div aria-hidden className={cn('glass rounded-card p-4 sm:p-6', className)}>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-2 h-3.5 w-56" />
      <Skeleton className="mt-6 w-full" style={{ height }} />
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4, className }: { rows?: number; columns?: number; className?: string }) {
  return (
    <div aria-hidden className={cn('space-y-3', className)}>
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={cn('h-4', c === 0 ? 'w-1/3' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}
