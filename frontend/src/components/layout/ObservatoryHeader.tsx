'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Radio, 
  Database, 
  Activity, 
  Cpu, 
  ChevronRight, 
  ArrowUpRight, 
  Layers,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import UnifiedDatasetSelector from '@/components/layout/UnifiedDatasetSelector';

const ROUTE_INFO: Record<string, { label: string; sector: string; badge: string }> = {
  '/dashboard': { label: 'Active Observatory', sector: 'TELEMETRY V8', badge: 'LIVE INGESTION' },
  '/forecast': { label: 'Digital Twin Forecast', sector: '90-DAY PROPHET ML', badge: 'WHAT-IF ENGINE' },
  '/query': { label: 'Intelligence Terminal', sector: 'GROQ GPT-OSS-120B', badge: 'SEMANTIC RAG' },
  '/ingest': { label: 'Data & Vector Reactor', sector: 'STREAM SCHEMA PROFILER', badge: 'AUTO-PROFILE' },
};

export default function ObservatoryHeader() {
  const pathname = usePathname();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [cycleTick, setCycleTick] = useState<number>(14);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const tickInterval = setInterval(() => {
      setCycleTick(prev => Math.floor(12 + Math.random() * 8));
    }, 3000);
    return () => clearInterval(tickInterval);
  }, []);

  const routeMeta = ROUTE_INFO[pathname] || { label: 'Digital Twin', sector: 'OBSERVATORY', badge: 'SYS.ACTIVE' };

  return (
    <header className="sticky top-0 z-40 w-full px-4 sm:px-8 py-3.5 bg-[#030507]/80 backdrop-blur-2xl border-b border-white/[0.07] transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* Left: Brand + Breadcrumb */}
        <div className="flex items-center gap-3 md:gap-5 min-w-0">
          <Link 
            href="/"
            className="group flex items-center gap-2.5 flex-shrink-0 transition-opacity hover:opacity-80"
          >
            <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-[#06090E] border border-white/10 shadow-[0_0_12px_rgba(0,229,153,0.3)]">
              <span className="w-2 h-2 rounded-[2px] bg-[#00E599] shadow-[0_0_8px_#00E599] group-hover:scale-110 transition-transform" />
            </div>
            <span className="font-display text-lg md:text-xl font-bold tracking-[0.12em] text-white">
              COGNITWIN
            </span>
          </Link>

          <ChevronRight className="w-3.5 h-3.5 text-white/20 hidden sm:block" />

          {/* Context Breadcrumb */}
          <div className="hidden sm:flex items-center gap-2 font-mono text-xs text-white/50">
            <span className="text-[10px] tracking-widest text-white/40 uppercase">{routeMeta.sector}</span>
            <span className="text-white/20">/</span>
            <span className="text-white font-medium tracking-wide truncate">{routeMeta.label}</span>
          </div>

          <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-[#00F0FF]/30 bg-[#00F0FF]/10 font-mono text-[9px] tracking-widest text-[#00F0FF] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-pulse" />
            {routeMeta.badge}
          </span>
        </div>

        {/* Right: Live Telemetry Metrics + Quick Actions */}
        <div className="flex items-center gap-2.5 sm:gap-4 font-mono text-xs">
          
          {/* Telemetry Tickers */}
          <div className="hidden xl:flex items-center gap-5 px-3.5 py-1.5 rounded-full bg-white/[0.02] border border-white/[0.06] text-white/50 text-[11px]">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-[#00F0FF]" />
              <span className="text-white/30">CYCLE:</span>
              <span className="text-white font-semibold tabular-nums">{cycleTick}ms</span>
            </div>
            <div className="w-[1px] h-3 bg-white/10" />
            <div className="flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-[#00E599]" />
              <span className="text-white/30">THROUGHPUT:</span>
              <span className="text-[#00E599] font-semibold tabular-nums">51.2K/s</span>
            </div>
            <div className="w-[1px] h-3 bg-white/10" />
            <div className="flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-[#FFB020]" />
              <span className="text-white/30">CLOCK:</span>
              <span className="text-white tabular-nums">{currentTime || 'LIVE'}</span>
            </div>
          </div>

          {/* Ingest Quick Action & Unified Twin Selector */}
          <UnifiedDatasetSelector />

          {/* Landing shortcut */}
          <Link
            href="/"
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#00E599]/10 hover:bg-[#00E599]/20 border border-[#00E599]/30 text-[#00E599] hover:text-white text-[11px] font-mono transition-all font-semibold"
          >
            <span>Overview</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

      </div>
    </header>
  );
}
