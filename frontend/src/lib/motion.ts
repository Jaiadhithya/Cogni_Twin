/**
 * Motion system — the single home for every easing, duration, spring and variant.
 * Components must not hard-code durations or easings; import from here.
 *
 * Rules:
 *  - animate transform, opacity and filter only (layout via framer-motion `layout`)
 *  - `prefers-reduced-motion` replaces movement with plain opacity fades
 *  - motion never blocks interaction
 */
import { useMemo, useSyncExternalStore } from 'react';
import type { Transition, Variants } from 'framer-motion';

/* ─── Tokens ─── */

export const ease = {
  /** Entrances. */
  out: [0.16, 1, 0.3, 1] as [number, number, number, number],
  /** State changes (hover, colour, size). */
  state: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

/** Seconds, as framer-motion expects. */
export const duration = {
  micro: 0.14,
  standard: 0.24,
  emphasis: 0.48,
  /** Landing hero only. */
  hero: 0.9,
  /** Number tweens. */
  count: 0.6,
};

export const stagger = {
  /** Delay between siblings, in seconds. */
  step: 0.05,
  /** Never stagger more than this many siblings. */
  maxItems: 8,
};

/** For anything the user drags or toggles. No visible wobble. */
export const spring: Transition = { type: 'spring', stiffness: 300, damping: 30 };

/** Delay for the nth sibling, capped so long lists do not drag. */
export function staggerDelay(index: number): number {
  return Math.min(Math.max(index, 0), stagger.maxItems - 1) * stagger.step;
}

export const transition = {
  micro: { duration: duration.micro, ease: ease.state } satisfies Transition,
  standard: { duration: duration.standard, ease: ease.state } satisfies Transition,
  enter: { duration: duration.emphasis, ease: ease.out } satisfies Transition,
  spring,
};

/* ─── Reduced motion ─── */

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReduced(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function getReduced(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCED_QUERY).matches;
}

/** Live result of a CSS media query. Server render assumes false. */
export function useMediaQuery(query: string): boolean {
  const subscribe = (onChange: () => void) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
    const mq = window.matchMedia(query);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  };
  const get = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  return useSyncExternalStore(subscribe, get, () => false);
}

/** True when the user asked the OS/browser for reduced motion. Server render assumes false. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, getReduced, () => false);
}

/**
 * Keep only opacity (and its transition) from every state of a variants map, so a
 * movement/blur animation degrades to a simple fade.
 */
export function toReducedVariants(variants: Variants): Variants {
  const out: Variants = {};
  for (const [name, state] of Object.entries(variants)) {
    if (typeof state === 'function' || state === undefined) continue;
    const { opacity, transition: tr } = state as { opacity?: number; transition?: Transition };
    const hasTransition = tr !== undefined;
    out[name] = {
      ...(opacity !== undefined ? { opacity } : {}),
      transition: hasTransition
        ? { ...tr, duration: duration.standard, ease: ease.state, delay: 0, staggerChildren: 0, delayChildren: 0 }
        : { duration: duration.standard, ease: ease.state },
    };
  }
  return out;
}

/* ─── Variants ─── */

export const variants = {
  /** Page content: fade in with a slight rise and a blur-to-sharp. Shell stays still. */
  pageEnter: {
    hidden: { opacity: 0, y: 10, filter: 'blur(4px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: transition.enter },
    exit: { opacity: 0, y: -4, filter: 'blur(2px)', transition: { duration: duration.micro, ease: ease.state } },
  },
  /** Parent that staggers its children. */
  staggerContainer: {
    hidden: {},
    visible: { transition: { staggerChildren: stagger.step, delayChildren: 0.04 } },
  },
  /** A staggered child rising into place. */
  staggerItem: {
    hidden: { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: transition.enter },
  },
  fadeBlur: {
    hidden: { opacity: 0, filter: 'blur(6px)' },
    visible: { opacity: 1, filter: 'blur(0px)', transition: { duration: duration.emphasis, ease: ease.out } },
  },
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: transition.standard },
    exit: { opacity: 0, transition: transition.micro },
  },
  /** Dialogs and popovers. */
  scaleIn: {
    hidden: { opacity: 0, scale: 0.96 },
    visible: { opacity: 1, scale: 1, transition: { duration: duration.standard, ease: ease.out } },
    exit: { opacity: 0, scale: 0.97, transition: transition.micro },
  },
  /** Toasts slide in from the right edge. */
  slideInRight: {
    hidden: { opacity: 0, x: 24 },
    visible: { opacity: 1, x: 0, transition: transition.enter },
    exit: { opacity: 0, x: 24, transition: transition.micro },
  },
} satisfies Record<string, Variants>;

export type VariantName = keyof typeof variants;

/** Variants for the current motion preference: full motion, or opacity-only fades. */
export function useVariants<K extends VariantName>(name: K): Variants {
  const reduced = usePrefersReducedMotion();
  return useMemo(() => (reduced ? toReducedVariants(variants[name]) : variants[name]), [reduced, name]);
}

/* ─── Charts ─── */

/**
 * Recharts animation props tuned to the motion tokens. Pass `reduced` from
 * usePrefersReducedMotion(); when set, charts render fully drawn with no animation.
 */
export function chartAnimation(reduced: boolean, delayMs = 0) {
  return {
    isAnimationActive: !reduced,
    animationDuration: Math.round(duration.emphasis * 1000 + 200),
    animationBegin: delayMs,
    animationEasing: 'ease-out' as const,
  };
}
