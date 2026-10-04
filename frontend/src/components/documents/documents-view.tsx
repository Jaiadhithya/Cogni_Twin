'use client';

import { useState } from 'react';
import { FileText, Search } from 'lucide-react';
import { summarizeHealth } from '@/components/layout/health';
import { Button } from '@/components/ui/button';
import { DropZone } from '@/components/ui/drop-zone';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { GlassCard } from '@/components/ui/glass-card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { RevealGroup, RevealItem } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { describeError } from '@/lib/api/errors';
import { formatPercent } from '@/lib/formatters';
import { useSearchDocuments, useUploadDocument } from '@/lib/hooks/mutations';
import { useHealth } from '@/lib/hooks/queries';

function metaLine(metadata: Record<string, unknown>): string {
  const name = metadata.filename ?? metadata.source ?? metadata.title;
  const page = metadata.page ?? metadata.page_number;
  return [name ? String(name) : null, page !== undefined ? `page ${String(page)}` : null].filter(Boolean).join(' · ');
}

export function DocumentsView() {
  const health = useHealth();
  const offline = health.data ? summarizeHealth(health.data, null, false).documentsOffline : false;
  const upload = useUploadDocument();
  const search = useSearchDocuments();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);
  const [asked, setAsked] = useState('');

  const onFile = (file: File) => {
    setClientError(null);
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setClientError('Only PDF documents are supported.');
      return;
    }
    upload.mutate(file, {
      onSuccess: (doc) => toast({ title: `${doc.filename} uploaded`, description: `Split into ${doc.chunk_count} searchable sections.`, tone: 'success' }),
    });
  };

  const onSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    setAsked(q);
    search.mutate({ query: q, topK: 5 });
  };

  const uploadError = clientError ?? (upload.isError ? describeError(upload.error) : null);

  return (
    <div className="space-y-6">
      <PageHeader title="Documents" description="Upload PDFs such as contracts and supplier reports, then search them by meaning." />

      {offline && (
        <p role="status" className="rounded-control bg-warning-tint px-4 py-3 text-sm text-warning">
          Document search is offline. You cannot upload or search documents until it is back; everything else keeps working.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Upload a document" className="space-y-3">
          <h2 className="t-h2">Upload</h2>
          <DropZone
            accept=".pdf,application/pdf"
            title={upload.isPending ? 'Reading your document…' : 'Drop a PDF here, or browse'}
            hint="One PDF at a time. Large files can take a minute to process."
            error={uploadError}
            disabled={offline || upload.isPending}
            onFile={onFile}
          />
          {upload.isSuccess && (
            <p role="status" className="text-sm text-ink-2">
              <FileText aria-hidden className="mr-1.5 inline size-4 text-ink-3" strokeWidth={1.75} />
              <strong className="font-medium text-ink">{upload.data.filename}</strong> is searchable ({upload.data.chunk_count} sections, {upload.data.status}).
            </p>
          )}
        </section>

        <section aria-label="Search documents" className="space-y-3">
          <h2 className="t-h2">Search</h2>
          <GlassCard>
            <form onSubmit={onSearch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input
                label="What are you looking for?"
                placeholder="e.g. delivery lead time"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                leading={<Search />}
                disabled={offline}
                className="flex-1"
              />
              <Button type="submit" variant="cta" loading={search.isPending} disabled={offline || query.trim() === ''}>
                Search
              </Button>
            </form>
          </GlassCard>

          <div aria-live="polite">
            {search.isPending && <Skeleton className="h-28 w-full rounded-card" />}
            {search.isError && <ErrorState error={search.error} title="Search failed" onRetry={() => search.mutate({ query: asked, topK: 5 })} />}
            {search.isSuccess && search.data.results.length === 0 && <EmptyState title="No matching passages" description={`Nothing in your documents matched “${asked}”. Try different words.`} />}
            {search.isSuccess && search.data.results.length > 0 && (
              <RevealGroup className="space-y-3">
                {search.data.results.map((hit) => (
                  <RevealItem key={hit.chunk_id}>
                    <GlassCard as="article" padding="sm" className="space-y-2">
                      <p className="text-[15px] text-ink">{hit.text}</p>
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
                        <span>{metaLine(hit.metadata) || 'Document'}</span>
                        <span aria-hidden>·</span>
                        <span>Match {formatPercent(hit.score * 100, 0)}</span>
                      </p>
                    </GlassCard>
                  </RevealItem>
                ))}
              </RevealGroup>
            )}
          </div>
        </section>
      </div>

      <p className="text-sm text-ink-3">CogniTwin cannot list or delete uploaded documents yet, so only upload and search are available here.</p>
    </div>
  );
}
