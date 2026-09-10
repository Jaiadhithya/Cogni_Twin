'use client';

import React, { useRef } from 'react';
import { useCursor } from '@/components/context/CursorContext';

interface MagneticElementProps {
  children: React.ReactNode;
  className?: string;
  borderRadius?: number;
}

export default function MagneticElement({ children, className = '', borderRadius = 9999 }: MagneticElementProps) {
  const { setCursorTarget } = useCursor();
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setCursorTarget({
        width: rect.width,
        height: rect.height,
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        borderRadius,
      });
    }
  };

  const handleMouseLeave = () => {
    setCursorTarget(null);
  };

  return (
    <div
      ref={ref}
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
}
