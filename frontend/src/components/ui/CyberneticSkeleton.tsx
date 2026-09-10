'use client';

import React from 'react';

export function CyberneticKPISkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#06090E]/60 p-5 shadow-xl backdrop-blur-md">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-[shimmer_2s_infinite] -translate-x-full" />
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 w-24 rounded bg-white/10" />
        <div className="h-6 w-6 rounded-lg bg-white/10" />
      </div>
      <div className="h-8 w-36 rounded bg-white/15 mb-2" />
      <div className="h-3 w-28 rounded bg-white/5" />
    </div>
  );
}

export function CyberneticChartSkeleton({ title = 'TELEMETRY SCANNING...' }: { title?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#06090E]/80 p-6 shadow-xl backdrop-blur-md min-h-[360px] flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#00F0FF] animate-ping" />
          <span className="font-mono text-xs font-semibold text-white/60 uppercase tracking-wider">{title}</span>
        </div>
        <div className="h-4 w-28 rounded bg-white/10" />
      </div>

      {/* Cybernetic Grid Simulation */}
      <div className="my-auto h-48 w-full flex items-end gap-2 px-2 pt-6">
        {[40, 65, 30, 85, 55, 90, 45, 70, 60, 95, 35, 80].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-gradient-to-t from-[#00F0FF]/10 to-[#00F0FF]/30 transition-all duration-700 animate-pulse"
            style={{ height: `${h}%`, animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-white/10 pt-3 text-[10px] font-mono text-white/40">
        <span>SAMPLING FREQUENCY: 1.2K/SEC</span>
        <span className="text-[#00F0FF] animate-pulse">SYNCHRONIZING OBSERVER MATRIX...</span>
      </div>
    </div>
  );
}

export function ZeroDataFallback({
  title = 'NO ACTIVE DATASET SIGNALS',
  description = 'The selected dataset appears to have zero parsed records or missing telemetry rows.',
  actionText = 'Load Enterprise Dataset',
  onAction,
}: {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#06090E]/90 p-8 shadow-2xl backdrop-blur-xl text-center flex flex-col items-center justify-center my-6">
      <div className="w-12 h-12 rounded-2xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(0,240,255,0.2)]">
        <div className="w-4 h-4 rounded-sm bg-[#00F0FF] animate-pulse" />
      </div>

      <h4 className="font-display text-base font-bold text-white tracking-wide uppercase mb-1">
        {title}
      </h4>

      <p className="font-mono text-xs text-white/60 max-w-md mb-6 leading-relaxed">
        {description}
      </p>

      {onAction && (
        <button
          onClick={onAction}
          className="px-5 py-2 rounded-full bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 border border-[#00F0FF]/40 text-[#00F0FF] hover:text-white font-mono text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.15)]"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
