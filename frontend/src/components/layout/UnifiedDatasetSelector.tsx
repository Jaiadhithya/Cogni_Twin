'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, ChevronDown, Check, UploadCloud } from 'lucide-react';
import { useDataset } from '@/context/DatasetContext';
import { cn } from '@/lib/utils';

export default function UnifiedDatasetSelector() {
  const { activeDatasetId, activeDataset, availableDatasets, selectDataset, isLoading } =
    useDataset();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'btn btn-secondary group !py-1.5 !px-2.5 !text-[11px] font-mono',
          isOpen && 'border-hairline-signal'
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="relative flex items-center justify-center">
          <Database className="h-3.5 w-3.5 text-signal" strokeWidth={1.5} />
          {isLoading && (
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-signal" />
          )}
        </span>
        <span className="hidden text-ink-muted sm:inline">Twin</span>
        <span
          className="max-w-[110px] truncate font-semibold text-ink md:max-w-[150px]"
          suppressHydrationWarning
        >
          {mounted ? activeDataset.name : 'Enterprise Retail Core'}
        </span>
        {activeDataset.row_count ? (
          <span
            className="hidden rounded-[var(--r-xs)] bg-graphite-800 px-1.5 py-0.5 font-mono text-[9px] text-ink-muted lg:inline-block"
            suppressHydrationWarning
          >
            {(activeDataset.row_count / 1000).toFixed(1)}k
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            'h-3 w-3 text-ink-muted transition-transform duration-[var(--dur-fast)',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="panel-elevated absolute right-0 top-full z-[var(--z-overlay)] mt-2 w-72 overflow-hidden p-2"
            role="listbox"
          >
            <div className="flex items-center justify-between border-b border-hairline px-2 pb-2">
              <span className="text-caption">Active datasets</span>
              <span className="font-mono text-[10px] text-signal">
                {availableDatasets.length} available
              </span>
            </div>

            <div className="max-h-60 space-y-0.5 overflow-y-auto pr-0.5">
              {availableDatasets.map((ds) => {
                const isSelected = ds.id === activeDatasetId;
                return (
                  <button
                    key={ds.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      selectDataset(ds.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-[var(--r-sm)] p-2.5 text-left transition-colors duration-[var(--dur-fast)]',
                      isSelected
                        ? 'bg-signal/10 ring-1 ring-hairline-signal'
                        : 'hover:bg-graphite-750'
                    )}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-semibold text-ink">{ds.name}</span>
                        {ds.isPreset && <span className="chip">Core</span>}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-ink-muted">
                        {ds.row_count ? <span>{ds.row_count.toLocaleString()} rows</span> : null}
                        {ds.row_count ? <span>·</span> : null}
                        <span className={cn(ds.status === 'READY' ? 'text-positive' : '')}>
                          {ds.status || 'Ready'}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 flex-shrink-0 text-signal" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 border-t border-hairline pt-2">
              <Link
                href="/ingest"
                onClick={() => setIsOpen(false)}
                className="btn btn-secondary w-full !text-[11px]"
              >
                <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.5} />
                Ingest new dataset
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
