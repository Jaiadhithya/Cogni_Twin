'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, FlaskConical, X } from 'lucide-react';
import { Dialog as RadixDialog } from 'radix-ui';
import { useActiveDataset } from '@/lib/dataset-context';
import { formatNumber } from '@/lib/formatters';
import { useDemoMode } from '@/lib/settings';
import { useReturnFocus } from '@/lib/use-return-focus';
import { cn } from '@/lib/utils';
import { isActivePath, SHEET_GROUPS } from './nav';

export interface NavSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Mobile: a full-screen sheet that slides up with every page, the dataset list and the demo status. */
export function NavSheet({ open, onOpenChange }: NavSheetProps) {
  const pathname = usePathname();
  const { withDataset, datasets, datasetId, setDatasetId } = useActiveDataset();
  const demo = useDemoMode();
  const returnFocus = useReturnFocus();

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-300 md:hidden" />
        <RadixDialog.Content
          {...returnFocus}
          aria-describedby={undefined}
          className="fixed inset-0 z-50 overflow-auto bg-bg/95 p-5 outline-none backdrop-blur-xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom duration-300 md:hidden"
        >
          <div className="mb-4 flex items-center justify-between">
            <RadixDialog.Title className="t-h2">Menu</RadixDialog.Title>
            <RadixDialog.Close aria-label="Close menu" className="grid size-10 place-items-center rounded-full bg-surface-solid text-ink-2 shadow-card">
              <X aria-hidden className="size-5" strokeWidth={1.75} />
            </RadixDialog.Close>
          </div>

          <nav aria-label="Pages" className="space-y-5">
            {SHEET_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="t-label mb-1.5 px-1 text-xs uppercase tracking-[0.06em]">{group.label}</p>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActivePath(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={withDataset(item.href)}
                          onClick={() => onOpenChange(false)}
                          aria-current={active ? 'page' : undefined}
                          className={cn('flex items-center gap-3 rounded-panel px-4 py-3 text-[15px] font-medium', active ? 'bg-primary-tint text-primary-ink' : 'glass text-ink')}
                        >
                          <Icon aria-hidden className="size-5" strokeWidth={1.75} />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <section aria-label="Dataset" className="mt-6">
            <p className="t-label mb-1.5 px-1 text-xs uppercase tracking-[0.06em]">Dataset</p>
            {datasets.length === 0 ? (
              <p className="px-1 text-sm text-ink-3">No datasets yet.</p>
            ) : (
              <ul className="space-y-1">
                {datasets.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setDatasetId(d.id);
                        onOpenChange(false);
                      }}
                      aria-pressed={d.id === datasetId}
                      className={cn('glass flex w-full items-center justify-between gap-3 rounded-panel px-4 py-3 text-left text-sm', d.id === datasetId && 'ring-2 ring-primary/40')}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">{d.filename}</span>
                        <span className="text-xs text-ink-3">{formatNumber(d.row_count)} rows</span>
                      </span>
                      {d.id === datasetId && <Check aria-hidden className="size-4 text-primary" strokeWidth={2} />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="mt-6 flex items-center gap-2 px-1 text-sm text-ink-2">
            <FlaskConical aria-hidden className="size-4" strokeWidth={1.75} />
            Demo mode is {demo ? 'on: you are looking at sample data' : 'off'}.
          </p>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
