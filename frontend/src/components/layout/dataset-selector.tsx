'use client';

import Link from 'next/link';
import { Check, ChevronDown, Database } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useActiveDataset } from '@/lib/dataset-context';
import { formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Compact dataset menu for the nav pill. Shows the active filename from 1024px up and
 * shrinks to an icon on tablet. The choice lives in the URL (?dataset=).
 */
export function DatasetSelector({ className }: { className?: string }) {
  const { datasets, datasetId, dataset, setDatasetId, isLoading, error } = useActiveDataset();

  if (isLoading) return <Skeleton className="h-9 w-9 rounded-full lg:w-40" />;
  if (error) return <span className="px-2 text-xs text-negative">Datasets unavailable</span>;

  if (datasets.length === 0) {
    return (
      <Link
        href="/upload"
        className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm text-ink-2 transition-colors hover:bg-black/[0.04] hover:text-primary-ink"
      >
        <Database aria-hidden className="size-4" strokeWidth={1.75} />
        <span className="hidden lg:inline">Upload a dataset</span>
        <span className="sr-only lg:hidden">Upload a dataset</span>
      </Link>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Active dataset: ${dataset?.filename ?? 'none selected'}`}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm text-ink-2 outline-none transition-colors hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-primary data-[state=open]:bg-black/[0.04]',
          className,
        )}
      >
        <Database aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
        <span className="hidden max-w-36 truncate lg:inline">{dataset?.filename ?? 'Choose dataset'}</span>
        <ChevronDown aria-hidden className="hidden size-3.5 text-ink-3 lg:block" strokeWidth={1.75} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={10}
          className="z-50 max-h-80 min-w-64 origin-[var(--radix-dropdown-menu-content-transform-origin)] overflow-auto rounded-panel border border-border bg-surface-solid p-1.5 shadow-menu data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 duration-200"
        >
          <DropdownMenu.Label className="px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">Active dataset</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={datasetId} onValueChange={setDatasetId}>
            {datasets.map((d) => (
              <DropdownMenu.RadioItem
                key={d.id}
                value={d.id}
                className="relative flex cursor-pointer select-none flex-col rounded-control py-2 pl-3 pr-9 text-sm text-ink outline-none data-[highlighted]:bg-primary-tint data-[state=checked]:font-medium"
              >
                <span className="truncate">{d.filename}</span>
                <span className="text-xs font-normal text-ink-3">{formatNumber(d.row_count)} rows</span>
                <DropdownMenu.ItemIndicator className="absolute right-3 top-1/2 -translate-y-1/2 text-primary">
                  <Check aria-hidden className="size-4" strokeWidth={2} />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
