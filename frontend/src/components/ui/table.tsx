'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  /** Cell content. */
  cell: (row: T) => React.ReactNode;
  /** Value to sort by; omit to make the column unsortable. */
  sortValue?: (row: T) => string | number | null;
  /** Right-align and use tabular figures. */
  numeric?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  columns: ReadonlyArray<Column<T>>;
  rows: ReadonlyArray<T>;
  rowKey: (row: T) => string;
  /** Accessible name, e.g. "Top products by revenue". */
  caption: string;
  /** Initial sort. */
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
  /** Max height in px before the body scrolls under a sticky header. */
  maxHeight?: number;
  className?: string;
}

type Direction = 'asc' | 'desc';

function compare(a: string | number | null, b: string | number | null): number {
  if (a === b) return 0;
  if (a === null) return 1; // nulls always last
  if (b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en-IN', { numeric: true });
}

/** Sortable table with a sticky header; scrolls horizontally on narrow screens. */
export function DataTable<T>({ columns, rows, rowKey, caption, defaultSort, maxHeight, className }: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; direction: Direction } | null>(defaultSort ?? null);

  const sorted = useMemo(() => {
    const column = columns.find((c) => c.key === sort?.key);
    if (!sort || !column?.sortValue) return rows;
    const get = column.sortValue;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      // keep nulls last regardless of direction
      if (av === null || bv === null) return compare(av, bv);
      return compare(av, bv) * factor;
    });
  }, [rows, columns, sort]);

  const toggle = (key: string) =>
    setSort((current) => (current?.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'desc' }));

  return (
    <div
      className={cn('w-full overflow-auto rounded-panel border border-border bg-surface-solid', className)}
      style={maxHeight ? { maxHeight } : undefined}
      tabIndex={0}
      role="region"
      aria-label={caption}
    >
      <table className="w-full border-collapse text-sm tabular-nums">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10 bg-surface-solid">
          <tr>
            {columns.map((column) => {
              const active = sort?.key === column.key;
              const ariaSort = active ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : column.sortValue ? 'none' : undefined;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={cn('border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-3', column.numeric ? 'text-right' : 'text-left')}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggle(column.key)}
                      className={cn('inline-flex items-center gap-1 rounded uppercase tracking-[0.04em] transition-colors hover:text-ink focus-visible:outline-2', column.numeric && 'flex-row-reverse', active && 'text-ink')}
                    >
                      {column.header}
                      {active ? (
                        sort?.direction === 'asc' ? <ArrowUp aria-hidden className="size-3.5" /> : <ArrowDown aria-hidden className="size-3.5" />
                      ) : (
                        <ChevronsUpDown aria-hidden className="size-3.5 opacity-50" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)} className="border-b border-border last:border-0 transition-colors hover:bg-primary-tint/40">
              {columns.map((column) => (
                <td key={column.key} className={cn('px-4 py-3 text-ink-2', column.numeric && 'text-right', column.className)}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
