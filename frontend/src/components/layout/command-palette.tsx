'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, Database, MessageSquare, RefreshCw, Search, UploadCloud, type LucideIcon } from 'lucide-react';
import { Dialog as RadixDialog } from 'radix-ui';
import { useActiveDataset } from '@/lib/dataset-context';
import { useReturnFocus } from '@/lib/use-return-focus';
import { cn } from '@/lib/utils';
import { ALL_NAV_ITEMS } from './nav';

interface PaletteContextValue {
  open: () => void;
}

const PaletteContext = createContext<PaletteContextValue | null>(null);

export function useCommandPalette(): PaletteContextValue {
  const ctx = useContext(PaletteContext);
  if (!ctx) throw new Error('useCommandPalette must be used inside <CommandPaletteProvider>.');
  return ctx;
}

interface Command {
  id: string;
  group: 'Pages' | 'Datasets' | 'Actions';
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

/** Ctrl/⌘+K palette: every page, switch dataset, and common actions. */
export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { datasets, datasetId, setDatasetId, withDataset } = useActiveDataset();
  const returnFocus = useReturnFocus();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const open = useCallback(() => {
    setQuery('');
    setActive(0);
    setIsOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setQuery('');
        setActive(0);
        setIsOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(withDataset(href));
    const pages: Command[] = ALL_NAV_ITEMS.map((item) => ({
      id: `page:${item.href}`,
      group: 'Pages',
      label: item.label,
      hint: item.description,
      icon: item.icon,
      run: go(item.href),
    }));
    const sets: Command[] = datasets
      .filter((d) => d.id !== datasetId)
      .map((d) => ({ id: `ds:${d.id}`, group: 'Datasets', label: `Switch to ${d.filename}`, icon: Database, run: () => setDatasetId(d.id) }));
    const actions: Command[] = [
      { id: 'act:upload', group: 'Actions', label: 'Upload data', icon: UploadCloud, run: go('/upload') },
      { id: 'act:retrain', group: 'Actions', label: 'Retrain model', icon: RefreshCw, run: go('/forecast?retrain=1') },
      { id: 'act:ask', group: 'Actions', label: 'Ask a question', icon: MessageSquare, run: go('/ask') },
    ];
    return [...pages, ...sets, ...actions];
  }, [datasets, datasetId, router, setDatasetId, withDataset]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q));
  }, [commands, query]);

  const choose = (command: Command | undefined) => {
    if (!command) return;
    setIsOpen(false);
    command.run();
  };

  const value = useMemo(() => ({ open }), [open]);
  let lastGroup = '';

  return (
    <PaletteContext.Provider value={value}>
      {children}
      <RadixDialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-200" />
          <RadixDialog.Content
            {...returnFocus}
            aria-describedby={undefined}
            className="fixed left-1/2 top-[14vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-card border border-border bg-surface-solid shadow-menu outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 duration-200"
          >
            <RadixDialog.Title className="sr-only">Command palette</RadixDialog.Title>
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search aria-hidden className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} />
              <input
                autoFocus
                role="combobox"
                aria-expanded
                aria-controls="palette-list"
                aria-activedescendant={results[active] ? `palette-${results[active].id}` : undefined}
                aria-label="Search pages, datasets and actions"
                placeholder="Search pages, datasets and actions…"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setActive((i) => Math.min(i + 1, results.length - 1));
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setActive((i) => Math.max(i - 1, 0));
                  } else if (event.key === 'Enter') {
                    event.preventDefault();
                    choose(results[active]);
                  }
                }}
                className="h-14 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
              />
              <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 text-[11px] text-ink-3 sm:block">Esc</kbd>
            </div>
            <ul id="palette-list" role="listbox" aria-label="Results" className="max-h-80 overflow-auto p-2">
              {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-ink-3">No matches for “{query}”.</li>}
              {results.map((command, index) => {
                const header = command.group !== lastGroup ? command.group : null;
                lastGroup = command.group;
                const Icon = command.icon;
                return (
                  <li key={command.id} role="presentation">
                    {header && <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">{header}</p>}
                    <div
                      id={`palette-${command.id}`}
                      role="option"
                      aria-selected={index === active}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => choose(command)}
                      className={cn('flex cursor-pointer items-center gap-3 rounded-control px-3 py-2.5 text-sm', index === active ? 'bg-primary-tint text-primary-ink' : 'text-ink-2')}
                    >
                      <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
                      <span className="min-w-0 flex-1 truncate">{command.label}</span>
                      {command.hint && <span className="hidden truncate text-xs text-ink-3 sm:block">{command.hint}</span>}
                      {index === active && <CornerDownLeft aria-hidden className="size-3.5 shrink-0" />}
                    </div>
                  </li>
                );
              })}
            </ul>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </PaletteContext.Provider>
  );
}
