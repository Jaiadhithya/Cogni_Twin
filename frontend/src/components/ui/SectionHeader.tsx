'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * SectionHeader — one consistent header block across every page.
 * Kills the 4-way duplication of eyebrow + display title + lede + divider.
 *
 * Eyebrows are optional and deliberately rare (max ~1 per 3 sections):
 * the section's position already categorizes it.
 */
type SectionHeaderProps = {
  /** Optional mono eyebrow. Use sparingly. */
  eyebrow?: string;
  title: React.ReactNode;
  /** Supporting line, plain verbs, one job. */
  lede?: React.ReactNode;
  /** Right-aligned actions (tabs, buttons). */
  actions?: React.ReactNode;
  className?: string;
  /** Render a hairline rule under the header. */
  rule?: boolean;
};

export function SectionHeader({
  eyebrow,
  title,
  lede,
  actions,
  className,
  rule = true,
}: SectionHeaderProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 space-y-2">
          {eyebrow && (
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-signal">
              <span className="status-dot status-dot--signal" aria-hidden="true" />
              {eyebrow}
            </div>
          )}
          <h2 className="text-h1 text-ink">{title}</h2>
          {lede && <p className="text-lede">{lede}</p>}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div>
        )}
      </div>
      {rule && <div className="rule-gradient mt-6" />}
    </div>
  );
}

export default SectionHeader;
