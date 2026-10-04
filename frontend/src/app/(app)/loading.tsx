import { ChartSkeleton, KpiSkeleton, Skeleton } from '@/components/ui/skeleton';

/** Route-level loading state: the shape of a typical page (title, KPI row, chart). */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
      <ChartSkeleton height={300} />
    </div>
  );
}
