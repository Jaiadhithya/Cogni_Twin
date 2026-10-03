import { Hammer } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';

export interface ComingSoonProps {
  title: string;
  description: string;
  /** Which overhaul phase delivers this page. */
  phase: 2 | 3 | 4;
  /** Route of the old version, still available until its replacement ships. */
  legacyHref?: string;
}

/** Placeholder for a page that a later phase of the frontend overhaul builds. */
export function ComingSoon({ title, description, phase, legacyHref }: ComingSoonProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={<Hammer strokeWidth={1.75} />}
        title={`Coming in Phase ${phase}`}
        description="This page is part of the frontend rebuild and has not been built yet."
        action={
          legacyHref ? (
            <ButtonLink href={legacyHref} variant="secondary" size="sm">
              Open the previous version
            </ButtonLink>
          ) : undefined
        }
      />
    </div>
  );
}
