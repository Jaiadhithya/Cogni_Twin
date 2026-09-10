'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import EnlargedThreadCanvas from '@/components/landing/EnlargedThreadCanvas';
import { LayoutDashboard, TrendingUp, Search, Database, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  const [paletteIndex, setPaletteIndex] = useState<number>(0);

  return (
    <main className="relative w-screen h-screen min-h-[640px] bg-[#030507] text-white overflow-hidden select-none font-sans cursor-default">
      
      {/* 1. HEROIC MAIN ATTRACTION: ENLARGED 3D THREAD CANVAS (LOCKED 360PX SWEEP & 5 STRANDS) */}
      <EnlargedThreadCanvas
        styleIndex={0}
        paletteIndex={paletteIndex}
        amplitude={360}
        strandCount={5}
      />

      {/* 2. MINIMAL OBSIDIAN TOP NAVIGATION */}
      <header className="fixed top-0 left-0 w-full z-40 px-6 md:px-12 py-5 flex items-center justify-between pointer-events-none">
        
        {/* Brand */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="w-2.5 h-2.5 rounded-[2px] bg-[#00E599] shadow-[0_0_16px_#00E599]" />
          <span className="font-display text-2xl font-bold tracking-[0.14em] text-white">COGNITWIN</span>
          <span className="hidden sm:inline-block font-mono text-[10px] tracking-widest text-[#00E599] px-2.5 py-0.5 rounded-full border border-[#00E599]/30 bg-[#00E599]/10">
            DIGITAL TWIN ML
          </span>
        </div>

        {/* Center Quick Nav Links */}
        <nav className="hidden lg:flex items-center gap-6 px-5 py-2 rounded-full bg-[#06090E]/80 backdrop-blur-xl border border-white/10 font-mono text-xs text-white/60 pointer-events-auto shadow-2xl">
          <Link href="/dashboard" className="hover:text-[#00F0FF] transition-colors flex items-center gap-1.5">
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>
          <Link href="/forecast" className="hover:text-[#00F0FF] transition-colors flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Forecast</span>
          </Link>
          <Link href="/query" className="hover:text-[#00F0FF] transition-colors flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5" />
            <span>AI Query</span>
          </Link>
          <Link href="/ingest" className="hover:text-[#00F0FF] transition-colors flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" />
            <span>Ingest</span>
          </Link>
        </nav>

        {/* Action Controls */}
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            onClick={() => setPaletteIndex((p) => (p + 1) % 3)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#06090E]/80 backdrop-blur-xl border border-white/10 font-mono text-[11px] text-zinc-300 hover:text-white transition-all hover:border-white/20 shadow-lg cursor-pointer"
            title="Cycle Spectral Palette"
          >
            <span
              className={`w-2 h-2 rounded-full transition-colors ${
                paletteIndex === 0 ? 'bg-[#00E599]' : paletteIndex === 1 ? 'bg-[#00F0FF]' : 'bg-[#FFB020]'
              }`}
            />
            <span>SPECTRUM</span>
          </button>
          
          <Link
            href="/dashboard"
            className="group flex items-center gap-2 px-5 py-2 rounded-full bg-white text-[#030507] hover:bg-[#00E599] font-mono text-xs tracking-wider uppercase font-bold transition-all shadow-[0_0_25px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(0,229,153,0.6)] hover:-translate-y-0.5 cursor-pointer"
          >
            <span>Launch Console</span>
            <span className="group-hover:translate-x-1 transition-transform font-bold">&rarr;</span>
          </Link>
        </div>

      </header>

      {/* 3. HERO CONTENT */}
      <div className="fixed inset-0 z-20 flex flex-col justify-between px-6 md:px-12 pt-28 pb-8 pointer-events-none">
        
        <div className="max-w-2xl mt-4 pointer-events-auto">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-white/10 bg-[#06090E]/80 backdrop-blur-xl font-mono text-[10px] tracking-[0.22em] text-[#00E599] uppercase mb-4 shadow-xl">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E599] animate-pulse" />
            <span>LIVING DIGITAL TWIN FOR BUSINESS OPERATIONS</span>
          </div>

          {/* Monumental Upright Headline */}
          <h1 className="font-display text-4xl sm:text-6xl lg:text-[76px] leading-[1.0] font-bold text-white tracking-[-0.035em]">
            Predictive intelligence,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E599] via-[#00F0FF] to-[#00E599] drop-shadow-[0_0_35px_rgba(0,229,153,0.4)]">
              woven into reality.
            </span>
          </h1>

          {/* Concise Info */}
          <p className="font-sans text-sm sm:text-base text-zinc-300 font-normal leading-relaxed max-w-lg mt-5 bg-[#030507]/60 backdrop-blur-xl p-4 rounded-xl border border-white/[0.08] shadow-2xl">
            Turn raw transaction records into a living computational twin. Automated demand forecasting and real-time cash flow protection engineered for modern business operators.
          </p>

          {/* Feature Tags */}
          <div className="flex flex-wrap items-center gap-2.5 mt-5 font-mono text-[11px] text-zinc-300">
            <span className="px-3.5 py-1.5 rounded-full bg-[#06090E]/80 backdrop-blur-md border border-white/10 flex items-center gap-1.5">
              <span className="text-[#00E599]">●</span> 1-Click CSV Ingest
            </span>
            <span className="px-3.5 py-1.5 rounded-full bg-[#06090E]/80 backdrop-blur-md border border-white/10 flex items-center gap-1.5">
              <span className="text-[#00F0FF]">●</span> 90-Day Prophet Forecast
            </span>
            <span className="px-3.5 py-1.5 rounded-full bg-[#06090E]/80 backdrop-blur-md border border-white/10 flex items-center gap-1.5">
              <span className="text-[#00E599]">●</span> Plain-English SHAP AI
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 mt-7">
            <Link
              href="/dashboard"
              className="px-8 py-3.5 rounded-full bg-[#00E599] hover:bg-[#00F0FF] text-[#030507] font-mono text-xs tracking-wider uppercase font-bold transition-all shadow-[0_0_30px_rgba(0,229,153,0.4)] hover:shadow-[0_0_35px_rgba(0,240,255,0.6)] hover:-translate-y-0.5 cursor-pointer"
            >
              Open Digital Twin &rarr;
            </Link>
            <Link
              href="/forecast"
              className="px-6 py-3.5 rounded-full bg-[#06090E]/80 hover:bg-white/10 text-zinc-200 hover:text-white font-mono text-xs tracking-wider uppercase font-medium border border-white/10 transition-all backdrop-blur-xl cursor-pointer"
            >
              Explore Forecast &rarr;
            </Link>
          </div>

        </div>

        {/* 4. SLEEK RAZOR-THIN BOTTOM TELEMETRY STRIP */}
        <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pointer-events-auto">
          
          {/* Operational Status */}
          <div className="bg-[#06090E]/80 backdrop-blur-xl border border-white/10 px-5 py-3 rounded-xl flex items-center gap-3 font-mono text-xs shadow-2xl">
            <span className="w-2 h-2 rounded-full bg-[#00E599] animate-pulse" />
            <span className="text-zinc-300 font-medium">AUTONOMOUS BUSINESS TWIN ACTIVE</span>
            <span className="text-zinc-600 hidden sm:inline">•</span>
            <span className="text-zinc-400 hidden sm:inline">CONTINUOUS INFERENCE ENGINE</span>
          </div>

          {/* Model Telemetry Metrics */}
          <div className="flex items-center gap-6 font-mono text-xs text-zinc-400 bg-[#06090E]/80 backdrop-blur-xl border border-white/10 px-5 py-3 rounded-xl shadow-2xl">
            <div>
              <span className="text-[9px] text-zinc-500 uppercase block">FORECAST DRIFT</span>
              <span className="text-sm font-bold text-white">1.42% MAPE</span>
            </div>
            <div className="border-l border-white/10 pl-4">
              <span className="text-[9px] text-zinc-500 uppercase block">PREDICTIVE SPAN</span>
              <span className="text-sm font-bold text-white">90 DAYS</span>
            </div>
            <div className="border-l border-white/10 pl-4">
              <span className="text-[9px] text-zinc-500 uppercase block">THROUGHPUT</span>
              <span className="text-sm font-bold text-[#00E599]">51,040 MSG/S</span>
            </div>
          </div>

        </div>

      </div>

    </main>
  );
}
