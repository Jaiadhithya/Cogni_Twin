'use client'

import React from 'react';
import { motion } from 'framer-motion';

interface PremiumGlassCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}

export function PremiumGlassCard({ children, className = 'p-5', glowColor }: PremiumGlassCardProps) {
  const hoverProps = glowColor ? {
    whileHover: { scale: 1.01, boxShadow: `0 0 16px ${glowColor}` }
  } : {
    whileHover: { scale: 1.01 }
  };

  return (
    <motion.div
      className={`inline-block p-[1px] rounded-[16px]`}
      style={{
        background: 'linear-gradient(to right bottom, rgba(255,255,255,0.18), rgba(255,255,255,0.03), rgba(0,0,0,0))'
      }}
      {...hoverProps}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <div 
        className={`w-full h-full rounded-[15px] ${className}`}
        style={{
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)'
        }}
      >
        {children}
      </div>
    </motion.div>
  );
}
