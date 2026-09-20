'use client';

import React from 'react';
import Link from 'next/link';
import EnlargedThreadCanvas from '@/components/landing/EnlargedThreadCanvas';
import { LayoutDashboard, TrendingUp, Search, Database, ArrowRight } from 'lucide-react';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/forecast', label: 'Forecast', icon: TrendingUp },
  { href: '/query', label: 'AI Query', icon: Search },
  { href: '/ingest', label: 'Ingest', icon: Database },
];

export default function LandingPage() {
  return (
    <main className="relative w-screen h-screen min-h-[640px] bg-graphite-950 text-ink overflow-hidden font-sans">
      {/* Ambient instrument layers — grid + warm vignette beneath the trace */}
      <div className="absolute inset-0 bg-grid pointer-events-none" aria-hidden />
      <div className="absolute inset-0 vignette pointer-events-none" aria-hidden />

      {/* The amber trace — the living signal at the heart of the instrument */}
      <EnlargedThreadCanvas styleIndex={0} amplitude={360} strandCount={5} />

      {/* Top navigation */}
      <header className="fixed top-0 left-0 w-full z-40 px-6 md:px-12 py-5 flex items-center justify-between pointer-events-none">
        {/* Brand */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <span
            className="status-dot status-dot--signal"
            style={{ width: 8, height: 8 }}
          />
          <span className="font-display text-2xl font-semibold tracking-[0.14em] text-ink">
            COGNITWIN
          </span>
          <span className="hidden sm:inline-flex chip chip--signal">DIGITAL TWIN ML</span>
        </div>

        {/* Center quick nav */}
        <nav className="hidden lg:flex items-center gap-1 px-2 py-1.5 panel pointer-events-auto">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="btn btn-ghost text-xs font-mono"
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        {/* Primary action */}
        <div className="pointer-events-auto">
          <Link href="/dashboard" className="btn btn-primary group">
            <span>Launch Console</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </header>

      {/* Hero content */}
      <div className="fixed inset-0 z-20 flex flex-col justify-between px-6 md:px-12 pt-28 pb-8 pointer-events-none">
        <div className="max-w-2xl mt-4 pointer-events-auto">
          {/* Badge */}
          <div className="inline-flex chip chip--signal mb-4">
            <span className="status-dot status-dot--signal breathe" />
            <span>LIVING DIGITAL TWIN FOR BUSINESS OPERATIONS</span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-4xl sm:text-6xl lg:text-[76px] leading-[1.0] font-semibold text-ink tracking-[-0.035em]">
            Predictive intelligence,<br />
            <span className="text-signal">woven into reality.</span>
          </h1>

          {/* Lede */}
          <p className="text-lede mt-5 max-w-lg panel p-4">
            Turn raw transaction records into a living computational twin. Automated demand
            forecasting and real-time cash flow protection engineered for modern business
            operators.
          </p>

          {/* Feature tags */}
          <div className="flex flex-wrap items-center gap-2.5 mt-5">
            <span className="chip"><span className="text-signal">●</span> 1-Click CSV Ingest</span>
            <span className="chip"><span className="text-signal">●</span> 90-Day Prophet Forecast</span>
            <span className="chip"><span className="text-signal">●</span> Plain-English SHAP AI</span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-4 mt-7">
            <Link href="/dashboard" className="btn btn-primary group">
              <span>Open Digital Twin</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link href="/forecast" className="btn btn-secondary group">
              <span>Explore Forecast</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Bottom telemetry strip */}
        <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pointer-events-auto">
          {/* Operational status */}
          <div className="panel px-5 py-3 flex items-center gap-3">
            <span className="status-dot status-dot--live" />
            <span className="text-data text-ink-secondary">AUTONOMOUS BUSINESS TWIN ACTIVE</span>
            <span className="text-ink-muted hidden sm:inline">•</span>
            <span className="text-data text-ink-muted hidden sm:inline">CONTINUOUS INFERENCE ENGINE</span>
          </div>

          {/* Model telemetry metrics */}
          <div className="panel flex items-center gap-6 px-5 py-3">
            <div>
              <span className="text-caption block">Forecast drift</span>
              <span className="text-data text-sm font-semibold text-ink">1.42% MAPE</span>
            </div>
            <div className="border-l border-[var(--hairline)] pl-4">
              <span className="text-caption block">Predictive span</span>
              <span className="text-data text-sm font-semibold text-ink">90 days</span>
            </div>
            <div className="border-l border-[var(--hairline)] pl-4">
              <span className="text-caption block">Ingest</span>
              <span className="text-data text-sm font-semibold text-ink">CSV · XLSX</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
