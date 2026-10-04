'use client';

import { Database } from 'lucide-react';
import { useActiveDataset } from '@/lib/dataset-context';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders its children once there is an active dataset. Until then: a skeleton while the
 * dataset list loads, the real error if it failed, or "upload a CSV" if there are none.
 */
export function DatasetGate({ children, skeleton, header }: { children: (datasetId: string) => React.ReactNode; skeleton?: React.ReactNode; header?: React.ReactNode }) {
  const { datasetId, isLoading, error, refetch } = useActiveDataset();
  if (datasetId) return <>{children(datasetId)}</>;
  // `header` keeps the page title on screen while there is no dataset to show.
  const wrap = (node: React.ReactNode) => (
    <div className="space-y-6">
      {header}
      {node}
    </div>
  );
  if (error) return wrap(<ErrorState error={error} title="We could not load your datasets" onRetry={refetch} />);
  if (isLoading) return wrap(skeleton ?? <Skeleton className="h-64 w-full rounded-card" />);
  return wrap(
    <EmptyState
      icon={<Database strokeWidth={1.75} />}
      title="No dataset yet"
      description="Upload a CSV of your sales and CogniTwin will build your digital twin."
      action={
        <ButtonLink href="/upload" variant="cta" size="md" arrow>
          Upload a CSV
        </ButtonLink>
      }
    />,
  );
}
