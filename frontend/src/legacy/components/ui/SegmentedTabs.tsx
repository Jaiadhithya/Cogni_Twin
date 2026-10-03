'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * SegmentedTabs — the one tab/segmented control in the system.
 * Kills the 5-way duplication (dimension tabs, horizon tabs, view-mode
 * switcher, ingest tabs, forecast picker).
 *
 * Uses a shared layoutId pill so the active indicator slides between tabs.
 */
type Tab<T extends string> = {
  value: T;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
};

type SegmentedTabsProps<T extends string> = {
  tabs: Tab<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
  /** Unique layoutId when multiple controls share a view. */
  layoutId?: string;
};

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  size = 'md',
  layoutId = 'segmented-active',
}: SegmentedTabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-[var(--r-sm)] border border-hairline bg-graphite-900 p-0.5',
        className
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--r-xs)] font-medium transition-colors duration-[var(--dur-fast)] cursor-pointer',
              size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
              active
                ? 'text-on-signal'
                : 'text-ink-muted hover:text-ink'
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-[var(--r-xs)] bg-signal"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}
            {Icon && (
              <Icon className={cn('relative z-10 h-3.5 w-3.5', size === 'sm' && 'h-3 w-3')} />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedTabs;
