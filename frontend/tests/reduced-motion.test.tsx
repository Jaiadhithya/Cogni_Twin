import React from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import * as framer from 'framer-motion';
import { CountUp } from '../src/components/ui/count-up';
import { chartAnimation, staggerDelay, stagger, toReducedVariants, usePrefersReducedMotion, variants } from '../src/lib/motion';

jest.mock('framer-motion', () => {
  const actual = jest.requireActual('framer-motion');
  return { ...actual, animate: jest.fn(() => ({ stop: jest.fn() })) };
});

type Listener = () => void;

function mockMatchMedia(reduced: boolean) {
  const listeners = new Set<Listener>();
  const mq = {
    matches: reduced,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  window.matchMedia = jest.fn().mockReturnValue(mq) as unknown as typeof window.matchMedia;
  return {
    set(next: boolean) {
      mq.matches = next;
      listeners.forEach((l) => l());
    },
  };
}

const animate = framer.animate as unknown as jest.Mock;

describe('reduced motion', () => {
  beforeEach(() => animate.mockClear());

  it('usePrefersReducedMotion follows the media query, including live changes', () => {
    const media = mockMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
    act(() => media.set(true));
    expect(result.current).toBe(true);
  });

  it('count-ups show the final value immediately and run no tween', () => {
    mockMatchMedia(true);
    const format = (v: number) => `₹${Math.round(v)}`;
    const { rerender } = render(<CountUp value={1000} format={format} />);
    expect(screen.getByText('₹1000')).toBeInTheDocument();
    rerender(<CountUp value={2500} format={format} />);
    expect(screen.getByText('₹2500')).toBeInTheDocument();
    expect(animate).not.toHaveBeenCalled();
  });

  it('without the preference, count-ups tween from the previous value to the new one', () => {
    mockMatchMedia(false);
    const { rerender } = render(<CountUp value={100} fromZero={false} />);
    expect(animate).not.toHaveBeenCalled(); // first paint at the value: nothing to tween
    rerender(<CountUp value={400} fromZero={false} />);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0][0]).toBe(100);
    expect(animate.mock.calls[0][1]).toBe(400);
    expect(animate.mock.calls[0][2]).toMatchObject({ duration: 0.6 });
  });

  it('turns movement variants into opacity-only fades', () => {
    for (const name of ['pageEnter', 'staggerItem', 'scaleIn', 'slideInRight', 'fadeBlur'] as const) {
      const reduced = toReducedVariants(variants[name]);
      for (const state of Object.values(reduced)) {
        const keys = Object.keys(state as object);
        expect(keys).not.toContain('y');
        expect(keys).not.toContain('x');
        expect(keys).not.toContain('scale');
        expect(keys).not.toContain('filter');
      }
      expect(reduced.hidden).toMatchObject({ opacity: 0 });
      expect(reduced.visible).toMatchObject({ opacity: 1 });
    }
  });

  it('removes staggering and delays under reduced motion', () => {
    const reduced = toReducedVariants(variants.staggerContainer);
    expect(reduced.visible).toMatchObject({ transition: { staggerChildren: 0, delayChildren: 0 } });
  });

  it('keeps the full-motion variants untouched', () => {
    expect(variants.pageEnter.hidden).toMatchObject({ opacity: 0, y: 10, filter: 'blur(4px)' });
  });

  it('turns chart animation off', () => {
    expect(chartAnimation(true).isAnimationActive).toBe(false);
    expect(chartAnimation(false).isAnimationActive).toBe(true);
  });

  it('caps staggering at eight siblings', () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(3)).toBeCloseTo(0.15);
    expect(staggerDelay(50)).toBeCloseTo((stagger.maxItems - 1) * stagger.step);
  });
});
