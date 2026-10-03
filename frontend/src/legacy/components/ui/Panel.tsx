'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Panel — the surface primitive. Replaces the four duplicated
 * gradient-shell card implementations (SpotlightCard, PremiumGlassCard,
 * BentoCard, VolumetricCard).
 *
 * Weightless: solid graphite + hairline + diffused shadow.
 * No spotlight, no hover lift, no neon glow.
 */
type PanelProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Recessed well — for stat strips and chart beds. */
  inset?: boolean;
  /** Signal treatment — reserved for one focal element per view. */
  signal?: boolean;
  /** Larger radius + elevation for top-level containers. */
  elevated?: boolean;
  /** Enables the quiet hover treatment. */
  interactive?: boolean;
};

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  (
    { className, inset, signal, elevated, interactive, children, ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          elevated ? 'panel-elevated' : 'panel',
          inset && 'panel-inset',
          signal && 'panel-signal',
          interactive && 'panel-hover',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Panel.displayName = 'Panel';

export default Panel;
