'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, Search, Sparkles } from 'lucide-react';
import { useActiveDataset } from '@/lib/dataset-context';
import { cn } from '@/lib/utils';
import { ALL_NAV_ITEMS } from './nav';

interface Result {
  key: string;
  label: string;
  hint: string;
  href: string;
  ai?: boolean;
}

/**
 * Search field in the reference style. It jumps to a page, or sends what you typed to Ask AI.
 */
export function PageSearch({ className }: { className?: string }) {
  const router = useRouter();
  const { withDataset } = useActiveDataset();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const pages = ALL_NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(q)).map((item) => ({
      key: item.href,
      label: item.label,
      hint: 'Go to page',
      href: withDataset(item.href),
    }));
    const ask: Result = {
      key: 'ask',
      label: `Ask AI: “${query.trim()}”`,
      hint: 'Ask in plain English',
      href: withDataset(`/ask?q=${encodeURIComponent(query.trim())}`),
      ai: true,
    };
    return [...pages, ask];
  }, [query, withDataset]);

  const go = (result: Result | undefined) => {
    if (!result) return;
    setOpen(false);
    setQuery('');
    router.push(result.href);
  };

  const expanded = open && results.length > 0;

  return (
    <div className={cn('relative', className)}>
      <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Search pages or ask a question"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Search or ask…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (event.key === 'Enter') {
            event.preventDefault();
            go(results[active]);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
        className="h-10 w-full rounded-full border border-border bg-surface-solid/80 pl-10 pr-4 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-[140ms] placeholder:text-ink-3 focus:border-primary focus:ring-[3px] focus:ring-primary/30"
      />
      {expanded && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-panel border border-border bg-surface-solid p-1.5 shadow-menu animate-in fade-in-0 zoom-in-95 duration-200"
        >
          {results.map((result, index) => (
            <li
              key={result.key}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                go(result);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-3 rounded-control px-3 py-2 text-sm',
                index === active ? 'bg-primary-tint text-primary-ink' : 'text-ink-2',
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                {result.ai && <Sparkles aria-hidden className="size-4 shrink-0 text-accent" strokeWidth={1.75} />}
                <span className="truncate">{result.label}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-ink-3">
                {result.hint}
                {index === active && <CornerDownLeft aria-hidden className="size-3" />}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
