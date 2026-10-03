'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import TraceMark from '@/legacy/components/ui/TraceMark';
import UnifiedDatasetSelector from '@/legacy/components/layout/UnifiedDatasetSelector';

const ROUTE_INFO: Record<string, { label: string; sector: string }> = {
  '/dashboard': { label: 'Observatory', sector: 'Telemetry' },
  '/forecast': { label: 'Forecast', sector: 'Prophet ML · 90-day' },
  '/query': { label: 'Analyst', sector: 'NL2SQL · Groq' },
  '/ingest': { label: 'Ingest', sector: 'Schema profiler' },
};

export default function ObservatoryHeader() {
  const pathname = usePathname();
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const routeMeta = ROUTE_INFO[pathname] || { label: 'Digital Twin', sector: 'Observatory' };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-hairline bg-graphite-950/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[var(--container)] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* Left — brand + sector breadcrumb */}
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="group flex flex-shrink-0 items-center gap-2.5"
            aria-label="CogniTwin home"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] border border-hairline-strong bg-graphite-850">
              <TraceMark width={18} height={14} className="transition-opacity group-hover:opacity-80" />
            </span>
            <span className="font-display text-base font-semibold tracking-[0.1em] text-ink">
              COGNITWIN
            </span>
          </Link>

          <ChevronRight className="hidden h-3.5 w-3.5 text-ink-muted/60 sm:block" aria-hidden="true" />

          <div className="hidden min-w-0 items-center gap-2 sm:flex">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              {routeMeta.sector}
            </span>
            <span className="text-ink-muted/40" aria-hidden="true">
              /
            </span>
            <span className="truncate text-sm font-medium text-ink">{routeMeta.label}</span>
          </div>
        </div>

        {/* Right — clock + dataset selector */}
        <div className="flex items-center gap-2.5">
          <time
            className="hidden items-center gap-1.5 font-mono text-[11px] tabular-nums text-ink-muted md:flex"
            aria-label="Current time"
          >
            <span className="status-dot status-dot--live" aria-hidden="true" />
            {currentTime || '--:--:--'}
          </time>

          <UnifiedDatasetSelector />
        </div>
      </div>
    </header>
  );
}
