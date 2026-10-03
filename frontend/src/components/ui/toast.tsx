'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useVariants } from '@/lib/motion';
import { cn } from '@/lib/utils';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milliseconds before it dismisses itself. Errors stay longer. */
  duration?: number;
}

interface ToastItem extends Required<Pick<ToastInput, 'title' | 'tone' | 'duration'>> {
  id: number;
  description?: string;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const tones = {
  success: { icon: CheckCircle2, color: 'text-positive' },
  error: { icon: AlertCircle, color: 'text-negative' },
  info: { icon: Info, color: 'text-primary' },
} as const;

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const variants = useVariants('slideInRight');
  const { icon: Icon, color } = tones[item.tone];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, onDismiss]);

  return (
    <motion.li
      layout
      variants={variants}
      initial="hidden"
      animate="visible"
      exit="exit"
      role={item.tone === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-panel border border-border bg-surface-solid p-4 shadow-menu"
    >
      <Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', color)} strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{item.title}</p>
        {item.description && <p className="mt-0.5 text-sm text-ink-2">{item.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
        className="grid size-6 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-black/5 hover:text-ink"
      >
        <X aria-hidden className="size-4" strokeWidth={1.75} />
      </button>
    </motion.li>
  );
}

/** Toasts slide in and stack smoothly. Each is announced to screen readers (alert for errors). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((current) => current.filter((t) => t.id !== id)), []);
  const toast = useCallback((input: ToastInput) => {
    const tone = input.tone ?? 'info';
    const item: ToastItem = {
      id: nextId.current++,
      title: input.title,
      description: input.description,
      tone,
      duration: input.duration ?? (tone === 'error' ? 8000 : 5000),
    };
    setItems((current) => [...current.slice(-3), item]);
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ol
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] ml-auto flex max-w-sm flex-col gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
      >
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <ToastCard key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </ol>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>.');
  return ctx;
}
