'use client';

import { useState } from 'react';
import { Database, Trash2 } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { DataState } from '@/components/ui/data-state';
import { EmptyState } from '@/components/ui/empty-state';
import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { TableSkeleton } from '@/components/ui/skeleton';
import { DataTable, type Column } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { describeError } from '@/lib/api/errors';
import { useActiveDataset } from '@/lib/dataset-context';
import { formatDate, formatNumber } from '@/lib/formatters';
import { useDeleteUpload } from '@/lib/hooks/mutations';
import { useUploads } from '@/lib/hooks/queries';
import { cn } from '@/lib/utils';
import type { UploadRecord } from '@/lib/api/types';

const STATUS_TONE: Record<string, string> = {
  completed: 'bg-positive-tint text-positive',
  failed: 'bg-negative-tint text-negative',
};

export function DatasetsView() {
  const uploads = useUploads(1, 100);
  const { datasetId, setDatasetId } = useActiveDataset();
  const remove = useDeleteUpload();
  const { toast } = useToast();
  const [target, setTarget] = useState<UploadRecord | null>(null);

  const confirmDelete = () => {
    if (!target) return;
    const name = target.filename;
    remove.mutate(target.id, {
      onSuccess: (result) => {
        setTarget(null);
        toast({
          title: `Deleted ${name}`,
          description: result.models_removed ? `${result.models_removed} trained model${result.models_removed === 1 ? '' : 's'} removed too.` : undefined,
          tone: 'success',
        });
      },
    });
  };

  const columns: Column<UploadRecord>[] = [
    {
      key: 'filename',
      header: 'Name',
      sortValue: (r) => r.filename,
      cell: (r) => (
        <span className="flex items-center gap-2.5">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-control bg-primary-tint text-primary-ink">
            <Database className="size-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink">{r.filename}</span>
            {r.warning_count > 0 && <span className="text-xs text-warning">{r.warning_count} warning{r.warning_count === 1 ? '' : 's'}</span>}
          </span>
        </span>
      ),
    },
    { key: 'rows', header: 'Rows', numeric: true, sortValue: (r) => r.row_count, cell: (r) => formatNumber(r.row_count) },
    { key: 'date', header: 'Uploaded', sortValue: (r) => r.created_at, cell: (r) => formatDate(r.created_at) },
    {
      key: 'status',
      header: 'Status',
      sortValue: (r) => r.status,
      cell: (r) => <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize', STATUS_TONE[r.status] ?? 'bg-black/5 text-ink-2')}>{r.status}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      numeric: true,
      cell: (r) => (
        <span className="inline-flex items-center justify-end gap-1">
          {r.id === datasetId ? (
            <span className="rounded-full bg-primary-tint px-3 py-1 text-xs font-semibold text-primary-ink">Active</span>
          ) : (
            <Button variant="ghost" onClick={() => setDatasetId(r.id)} aria-label={`Set ${r.filename} as active`}>
              Set active
            </Button>
          )}
          <Button variant="ghost" className="text-negative hover:bg-negative-tint" onClick={() => { remove.reset(); setTarget(r); }} aria-label={`Delete ${r.filename}`} icon={<Trash2 className="size-4" strokeWidth={1.75} />}>
            Delete
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Datasets"
        description="Everything you have uploaded. Choose which dataset the app looks at, or delete one."
        actions={
          <ButtonLink href="/upload" variant="cta" size="sm" arrow>
            Upload data
          </ButtonLink>
        }
      />
      <GlassCard>
        <DataState
          query={uploads}
          errorTitle="We could not load your datasets"
          isEmpty={(d) => d.records.length === 0}
          skeleton={<TableSkeleton rows={4} columns={5} />}
          empty={
            <EmptyState
              bare
              icon={<Database strokeWidth={1.75} />}
              title="No datasets yet"
              description="Upload a CSV of your sales to get started."
              action={
                <ButtonLink href="/upload" variant="cta" size="sm" arrow>
                  Upload a CSV
                </ButtonLink>
              }
            />
          }
        >
          {(data) => <DataTable columns={columns} rows={data.records} rowKey={(r) => r.id} caption="Uploaded datasets" defaultSort={{ key: 'date', direction: 'desc' }} />}
        </DataState>
      </GlassCard>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        title={`Delete “${target?.filename ?? ''}”?`}
        description="This permanently deletes the dataset and also deletes its trained forecasting model. Saved scenarios built on it will no longer work. This cannot be undone."
        confirmLabel="Delete dataset"
        destructive
        loading={remove.isPending}
        onConfirm={confirmDelete}
      >
        {remove.isError && (
          <p role="alert" className="rounded-control bg-negative-tint px-3 py-2 text-negative">
            {describeError(remove.error)}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
