'use client';

import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { DatasetSelector } from './dataset-selector';
import { DemoBadge } from './demo-badge';
import { HealthPill } from './health-pill';
import { titleForPath } from './nav';
import { PageSearch } from './page-search';

/** Page title on the left; dataset selector, search and the backend status pill on the right. */
export function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation menu"
          className="grid size-10 place-items-center rounded-control text-ink-2 transition-colors hover:bg-black/5 md:hidden"
        >
          <Menu aria-hidden className="size-5" strokeWidth={1.75} />
        </button>
        <p className="mr-auto text-[15px] font-semibold text-ink">{titleForPath(pathname)}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <DemoBadge />
          <DatasetSelector />
          <PageSearch className="hidden w-64 lg:block" />
          <HealthPill />
        </div>
      </div>
    </header>
  );
}
