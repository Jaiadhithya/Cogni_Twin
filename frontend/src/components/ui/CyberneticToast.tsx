'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  WifiOff, 
  Wifi, 
  X, 
  Sparkles,
  Layers,
  Database
} from 'lucide-react';
import { useDataset } from '@/context/DatasetContext';

export type ToastType = 'success' | 'warning' | 'error' | 'info' | 'network';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const { isOnline, activeDataset } = useDataset();

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newToast: ToastItem = { ...toast, id };
    setToasts((prev) => [...prev.slice(-4), newToast]);

    const duration = toast.duration ?? 4500;
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  // Network drop / recovery notifications
  useEffect(() => {
    if (!isOnline) {
      addToast({
        type: 'network',
        title: 'TELEMETRY LINK DROPPED',
        message: 'Network offline. Digital twin running on resilient local synthetic cache.',
        duration: 7000,
      });
    } else {
      addToast({
        type: 'success',
        title: 'SIGNAL RESTORED',
        message: 'Connected to Observatory telemetry network.',
        duration: 3500,
      });
    }
  }, [isOnline, addToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      
      {/* HUD Floating Toast Stack */}
      <div 
        aria-live="polite"
        className="fixed bottom-24 right-6 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="pointer-events-auto relative overflow-hidden rounded-xl border border-white/15 bg-[#06090E]/95 p-3.5 shadow-[0_12px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl"
            >
              {/* Top Accent Scanline */}
              <div 
                className={`absolute top-0 left-0 right-0 h-[2px] ${
                  toast.type === 'network' || toast.type === 'error'
                    ? 'bg-[#FF4466]'
                    : toast.type === 'warning'
                    ? 'bg-[#FFB020]'
                    : toast.type === 'success'
                    ? 'bg-[#00E599]'
                    : 'bg-[#00F0FF]'
                }`}
              />

              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  {toast.type === 'network' ? (
                    <WifiOff className="w-4 h-4 text-[#FF4466] animate-pulse" />
                  ) : toast.type === 'error' ? (
                    <AlertTriangle className="w-4 h-4 text-[#FF4466]" />
                  ) : toast.type === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-[#FFB020]" />
                  ) : toast.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-[#00E599]" />
                  ) : (
                    <Info className="w-4 h-4 text-[#00F0FF]" />
                  )}
                </div>

                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                      {toast.title}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-white/70 leading-relaxed mt-0.5">
                    {toast.message}
                  </p>
                </div>

                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-white/40 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
