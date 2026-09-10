'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutDashboard, TrendingUp, Database, Search } from 'lucide-react';
import MagneticElement from '@/components/ui/MagneticElement';

const DOCK_LINKS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, shortcut: '1' },
  { name: 'Forecast', href: '/forecast', icon: TrendingUp, shortcut: '2' },
  { name: 'Ingest', href: '/ingest', icon: Database, shortcut: '3' },
  { name: 'Query', href: '/query', icon: Search, shortcut: '4' },
];

export default function BottomDock() {
  const pathname = usePathname();
  const router = useRouter();

  // Global keyboard shortcuts (Cmd+1..4 or Alt+1..4 or 1..4 when not typing in input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in input, textarea, or contentEditable
      const target = e.target as HTMLElement;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.key === '1') router.push('/dashboard');
      if (e.key === '2') router.push('/forecast');
      if (e.key === '3') router.push('/ingest');
      if (e.key === '4') router.push('/query');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
      <div className="bg-[#06090E]/90 backdrop-blur-2xl border border-white/[0.1] rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_1px_1px_rgba(255,255,255,0.06)_inset]">
        {DOCK_LINKS.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;

          return (
            <MagneticElement key={link.name} borderRadius={9999} className="flex">
              <Link
                href={link.href}
                className="relative px-3.5 py-1.5 flex items-center gap-2 rounded-full font-mono text-xs transition-all duration-200 group"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeDockTab"
                    className="absolute inset-0 bg-[#00F0FF]/15 border border-[#00F0FF]/50 rounded-full shadow-[0_0_18px_rgba(0,240,255,0.35)]"
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  />
                )}
                <Icon
                  className={`w-3.5 h-3.5 relative z-10 transition-colors duration-200 ${
                    isActive ? 'text-[#00F0FF]' : 'text-white/45 group-hover:text-white/90'
                  }`}
                />
                <span
                  className={`relative z-10 transition-colors uppercase tracking-wider text-[11px] ${
                    isActive ? 'font-semibold text-white' : 'text-white/50 group-hover:text-white/90'
                  }`}
                >
                  {link.name}
                </span>
                <span
                  className={`relative z-10 text-[9px] px-1 py-0.5 rounded font-mono transition-colors ${
                    isActive
                      ? 'bg-[#00F0FF]/25 text-[#00F0FF] font-semibold'
                      : 'bg-white/[0.05] text-white/30 group-hover:text-white/60'
                  }`}
                >
                  ⌘{link.shortcut}
                </span>
              </Link>
            </MagneticElement>
          );
        })}

        {/* Telemetry Divider */}
        <div className="w-[1px] h-4 bg-white/10 mx-1" />

        {/* Telemetry Status Beacon */}
        <div className="flex items-center gap-1.5 px-2.5 text-[10px] font-mono text-white/50">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00E599] animate-pulse shadow-[0_0_8px_#00E599]" />
          <span className="tracking-widest hidden sm:inline">ONLINE</span>
        </div>
      </div>
    </nav>
  );
}
