'use client';

import { useState } from 'react';
import { CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { DropZone } from '@/components/ui/drop-zone';
import { GlassCard } from '@/components/ui/glass-card';
import { JobStatus } from '@/components/ui/job-status';
import { PageHeader } from '@/components/ui/page-header';
import { RevealGroup, RevealItem } from '@/components/ui/reveal';
import { describeError } from '@/lib/api/errors';
import { formatNumber } from '@/lib/formatters';
import { useIngestCsv } from '@/lib/hooks/mutations';
import { useTrainingJob } from '@/lib/hooks/training';
import { humanizeLever } from '@/lib/forecast';
import type { IngestResult } from '@/lib/api/types';

function Detected({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div>
      <dt className="t-label">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-medium text-ink">{value ? humanizeLever(value) : <span className="font-normal text-warning">Not detected</span>}</dd>
    </div>
  );
}

function Result({ result, fileName }: { result: IngestResult; fileName: string }) {
  const training = useTrainingJob(result.dataset_id);
  const mapping = result.column_mapping;
  const dims = mapping.dimensions ?? [];

  return (
    <RevealGroup className="space-y-5">
      <RevealItem>
        <GlassCard className="space-y-5" aria-label="Upload result">
          <div className="flex items-start gap-3">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-positive-tint text-positive">
              <CheckCircle2 className="size-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h2 className="t-h2">Your data is in</h2>
              <p className="truncate text-sm text-ink-3">{fileName}</p>
            </div>
          </div>
          <dl className="grid gap-4 sm:grid-cols-4">
            <div>
              <dt className="t-label">Rows</dt>
              <dd className="mt-0.5 text-[15px] font-medium tabular-nums text-ink">{formatNumber(result.row_count)}</dd>
            </div>
            <Detected label="Date column" value={mapping.primary_date} />
            <Detected label="Sales column" value={mapping.target_metric} />
            <div>
              <dt className="t-label">Breakdowns</dt>
              <dd className="mt-0.5 text-[15px] font-medium text-ink">{dims.length ? dims.map(humanizeLever).join(', ') : <span className="font-normal text-ink-3">None found</span>}</dd>
            </div>
          </dl>
          {result.warnings.length > 0 && (
            <div role="status" className="rounded-control bg-warning-tint p-4 text-sm text-warning">
              <p className="font-semibold">Things to check</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button variant="cta" loading={training.isActive} disabled={training.succeeded} onClick={training.start}>
              {training.succeeded ? 'Model trained' : 'Train model'}
            </Button>
            <ButtonLink href={`/dashboard?dataset=${result.dataset_id}`} variant="secondary" arrow>
              Go to dashboard
            </ButtonLink>
          </div>
        </GlassCard>
      </RevealItem>
      {training.status !== 'idle' && (
        <RevealItem>
          <JobStatus phase={training.status} error={training.failureMessage ?? training.error?.message ?? null} timedOut={training.timedOut} className="max-w-xl" />
        </RevealItem>
      )}
    </RevealGroup>
  );
}

export function UploadView() {
  const ingest = useIngestCsv();
  const [clientError, setClientError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const onFile = (file: File) => {
    setClientError(null);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setClientError('Only CSV files are supported. Export your sales as a .csv file and try again.');
      return;
    }
    setFileName(file.name);
    ingest.reset();
    ingest.mutate(file);
  };

  const error = clientError ?? (ingest.isError ? describeError(ingest.error) : null);

  return (
    <div className="space-y-6">
      <PageHeader title="Upload data" description="Upload a CSV of your sales and CogniTwin builds your digital twin. Include a date column and a sales or revenue column." />

      <DropZone
        accept=".csv,text/csv"
        title={ingest.isPending ? `Reading ${fileName}…` : 'Drop your sales CSV here, or browse'}
        hint={ingest.isPending ? 'Uploading and detecting your columns. Larger files take a little longer.' : 'One .csv file. We detect the date and sales columns for you.'}
        fileName={ingest.isPending ? fileName : null}
        error={error}
        disabled={ingest.isPending}
        onFile={onFile}
      />

      {ingest.isPending && (
        <div role="progressbar" aria-label="Uploading" className="h-1.5 overflow-hidden rounded-full bg-black/[0.07]">
          <div className="h-full w-1/3 rounded-full bg-primary" style={{ animation: 'progress-sheen 1.4s var(--ease-state) infinite' }} />
        </div>
      )}

      {ingest.isSuccess && fileName && <Result result={ingest.data} fileName={fileName} />}

      {!ingest.isSuccess && !ingest.isPending && (
        <GlassCard className="flex items-start gap-3 text-sm text-ink-2">
          <FileSpreadsheet aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-3" strokeWidth={1.75} />
          <p>Tip: one row per sale or per day works best. Columns such as price, marketing spend and discount let you run what-if scenarios later.</p>
        </GlassCard>
      )}
    </div>
  );
}
