'use client';

import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import { useDemoMode } from '@/lib/settings';
import { cn } from '@/lib/utils';

/** Amber badge shown on every page while Demo mode is on. Links to the switch. */
export function DemoBadge({ className }: { className?: string }) {
  const demo = useDemoMode();
  if (!demo) return null;
  return (
    <Link
      href="/settings"
      title="You are looking at sample data, not your own. Open Settings to switch Demo mode off."
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-warning-tint px-3 py-1.5 text-xs font-semibold text-warning ring-1 ring-warning/20 transition-colors hover:bg-warning/10',
        className,
      )}
    >
      <FlaskConical aria-hidden className="size-3.5" strokeWidth={1.75} />
      Demo data
    </Link>
  );
}
