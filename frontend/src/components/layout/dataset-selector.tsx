'use client';

import Link from 'next/link';
import { Database } from 'lucide-react';
import { useActiveDataset } from '@/lib/dataset-context';
import { formatNumber } from '@/lib/formatters';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

/** Which dataset every page is looking at. The choice lives in the URL (?dataset=). */
export function DatasetSelector({ className }: { className?: string }) {
  const { datasets, datasetId, setDatasetId, isLoading, error } = useActiveDataset();

  if (isLoading) return <Skeleton className="h-11 w-52" />;

  if (error) {
    return <span className="text-xs text-negative">Could not load datasets</span>;
  }

  if (datasets.length === 0) {
    return (
      <Link
        href="/upload"
        className="inline-flex h-11 items-center gap-2 rounded-control border border-dashed border-border-strong px-3.5 text-sm text-ink-2 transition-colors hover:border-primary hover:text-primary-ink"
      >
        <Database aria-hidden className="size-4" strokeWidth={1.75} />
        Upload a dataset
      </Link>
    );
  }

  return (
    <Select
      aria-label="Active dataset"
      value={datasetId}
      onValueChange={setDatasetId}
      options={datasets.map((d) => ({ value: d.id, label: d.filename, description: `${formatNumber(d.row_count)} rows` }))}
      className={className}
      triggerClassName="h-10 w-44 sm:w-56"
    />
  );
}
