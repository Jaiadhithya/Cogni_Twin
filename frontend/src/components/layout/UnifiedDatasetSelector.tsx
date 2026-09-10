'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  ChevronDown, 
  Check, 
  UploadCloud, 
  Sparkles, 
  Layers, 
  Activity,
  HardDrive
} from 'lucide-react';
import { useDataset } from '@/context/DatasetContext';

export default function UnifiedDatasetSelector() {
  const { activeDatasetId, activeDataset, availableDatasets, selectDataset, isLoading } = useDataset();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-[#00F0FF]/40 text-white text-[11px] font-mono transition-all cursor-pointer group"
      >
        <div className="relative flex items-center justify-center">
          <Database className="w-3.5 h-3.5 text-[#00F0FF] group-hover:scale-110 transition-transform" />
          {isLoading && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-ping" />
          )}
        </div>
        <span className="hidden sm:inline text-white/50">Twin:</span>
        <span className="font-semibold text-white max-w-[120px] md:max-w-[160px] truncate">
          {activeDataset.name}
        </span>
        {activeDataset.row_count && (
          <span className="hidden lg:inline-block px-1.5 py-0.2 rounded bg-white/10 text-[9px] text-[#00E599] font-mono">
            {(activeDataset.row_count / 1000).toFixed(1)}k
          </span>
        )}
        <ChevronDown className={`w-3 h-3 text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Cybernetic HUD Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-white/15 bg-[#06090E]/95 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-white/10 font-mono text-[10px] text-white/40 uppercase tracking-wider">
              <span>ACTIVE DATASET MATRICES</span>
              <span className="text-[#00F0FF]">{availableDatasets.length} AVAILABLE</span>
            </div>

            {/* List */}
            <div className="space-y-1 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
              {availableDatasets.map((ds) => {
                const isSelected = ds.id === activeDatasetId;
                return (
                  <button
                    key={ds.id}
                    onClick={() => {
                      selectDataset(ds.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer font-mono ${
                      isSelected
                        ? 'bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-white'
                        : 'hover:bg-white/[0.04] text-white/70 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate">{ds.name}</span>
                        {ds.isPreset && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-white/50">
                            CORE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/40">
                        {ds.row_count && (
                          <span>{ds.row_count.toLocaleString()} rows</span>
                        )}
                        <span>•</span>
                        <span className="text-[#00E599]">{ds.status || 'READY'}</span>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-[#00F0FF] flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bottom Ingest Action */}
            <div className="mt-2 pt-2 border-t border-white/10">
              <Link
                href="/ingest"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-[#00F0FF] hover:text-white text-xs font-mono font-semibold transition-all"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Ingest New Matrix (CSV)</span>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
