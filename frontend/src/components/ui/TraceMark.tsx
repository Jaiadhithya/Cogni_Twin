'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * TraceMark — the signature visual element.
 * A living amber signal trace rendered as SVG. Used as the brand mark,
 * as living dividers, and as inline sparklines. The product forecasts
 * time-series; the trace is its mark.
 */

type TraceMarkProps = {
  values?: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
  /** Animate the line drawing in on mount. */
  draw?: boolean;
  'aria-hidden'?: boolean;
};

export function TraceMark({
  values = [4, 6, 5, 8, 7, 10, 9, 12, 11, 14],
  width = 56,
  height = 20,
  strokeWidth = 1.75,
  className,
  draw = false,
  'aria-hidden': ariaHidden,
}: TraceMarkProps) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - strokeWidth * 2) + strokeWidth;
    const y = height - strokeWidth - ((v - min) / span) * (height - strokeWidth * 2);
    return [x, y] as const;
  });

  // Catmull-Rom → bezier smoothing for an instrument-smooth trace.
  const path = points.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`;
    const [px, py] = points[i - 1];
    const cx = (px + x) / 2;
    return `${acc} C ${cx} ${py} ${cx} ${y} ${x} ${y}`;
  }, '');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      className={cn('text-signal', className)}
      aria-hidden={ariaHidden ?? true}
      role="img"
    >
      <path
        d={path}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={draw ? 'trace-draw' : undefined}
        style={draw ? { ['--trace-len' as string]: width * 2 } : undefined}
      />
    </svg>
  );
}

export default TraceMark;
