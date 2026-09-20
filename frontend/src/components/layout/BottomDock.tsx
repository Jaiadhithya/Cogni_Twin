'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutDashboard, TrendingUp, Database, Search } from 'lucide-react';
import { useDataset } from '@/context/DatasetContext';

const DOCK_LINKS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, shortcut: '1' },
  { name: 'Forecast', href: '/forecast', icon: TrendingUp, shortcut: '2' },
  { name: 'Ingest', href: '/ingest', icon: Database, shortcut: '3' },
  { name: 'Analyst', href: '/query', icon: Search, shortcut: '4' },
];

export default function BottomDock() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeDataset } = useDataset();

  // Keyboard shortcuts: 1–4 jump between sections (ignored while typing).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }
      const match = DOCK_LINKS.find((l) => l.shortcut === e.key);
      if (match) router.push(match.href);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  return (
    <nav
      className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2"
      aria-label="Section navigation"
    >
      <div className="flex items-center gap-1 rounded-[var(--r-md)] border border-hairline-strong bg-graphite-900/92 p-1 shadow-xl backdrop-blur-xl">
        {DOCK_LINKS.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;

          return (
            <Link
              key={link.name}
              href={link.href}
              className="relative flex items-center gap-2 rounded-[var(--r-sm)] px-3 py-1.5 transition-colors duration-[var(--dur-fast)] sm:px-3.5"
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <motion.span
                  layoutId="activeDockTab"
                  className="absolute inset-0 rounded-[var(--r-sm)] border border-hairline-signal bg-signal/12"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <Icon
                className={`relative z-10 h-4 w-4 transition-colors duration-[var(--dur-fast)] ${
                  isActive ? 'text-signal' : 'text-ink-muted hover:text-ink'
                }`}
              />
              <span
                className={`relative z-10 text-xs font-medium transition-colors duration-[var(--dur-fast)] ${
                  isActive ? 'text-signal' : 'text-ink-muted hover:text-ink'
                }`}
              >
                <span className="hidden sm:inline">{link.name}</span>
                <span className="sr-only sm:hidden">{link.name}</span>
              </span>
            </Link>
          );
        })}

        {/* Live status beacon */}
        <div className="mx-1 hidden items-center gap-1.5 border-l border-hairline pl-2.5 sm:flex">
          <span className="status-dot status-dot--live breathe" aria-hidden="true" />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
            {activeDataset?.name ? 'Linked' : 'Demo'}
          </span>
        </div>
      </div>
    </nav>
  );
}
