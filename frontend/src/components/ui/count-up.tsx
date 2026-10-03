'use client';

import { useEffect, useRef } from 'react';
import { animate } from 'framer-motion';
import { duration, ease, usePrefersReducedMotion } from '@/lib/motion';
import { cn } from '@/lib/utils';

export interface CountUpProps {
  value: number;
  /** Turns the (possibly mid-tween) number into text. Defaults to a plain grouped number. */
  format?: (value: number) => string;
  /** On first render, count up from 0 instead of showing the value at once. */
  fromZero?: boolean;
  className?: string;
}

const defaultFormat = (v: number) => Math.round(v).toLocaleString('en-IN');

/**
 * A number that tweens from its previous value to the new one (~600ms, easeOutExpo) with
 * tabular figures. Writes straight to the DOM node, so a tween never re-renders React.
 * With reduced motion the final value is shown immediately.
 */
export function CountUp({ value, format = defaultFormat, fromZero = true, className }: CountUpProps) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);
  const formatRef = useRef(format);

  useEffect(() => {
    formatRef.current = format;
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const from = shown.current ?? (fromZero ? 0 : value);
    if (reduced || from === value) {
      shown.current = value;
      node.textContent = formatRef.current(value);
      return;
    }
    const controls = animate(from, value, {
      duration: duration.count,
      ease: ease.out,
      onUpdate: (latest) => {
        shown.current = latest;
        node.textContent = formatRef.current(latest);
      },
      onComplete: () => {
        shown.current = value;
        node.textContent = formatRef.current(value);
      },
    });
    return () => controls.stop();
  }, [value, reduced, fromZero]);

  // The server render and first paint carry the final text, so screen readers and no-JS see the truth.
  return (
    <span ref={ref} className={cn('tabular-nums', className)} data-tabular>
      {format(value)}
    </span>
  );
}
