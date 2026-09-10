'use client';

import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';

export default function SpotlightCard({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <motion.div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      whileHover={{ y: -5, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`relative w-full h-full overflow-hidden rounded-[16px] p-[1px] ${className}`}
    >
      {/* Outer Shell Gradient */}
      <div 
        className="absolute inset-0 z-0 transition-opacity duration-500" 
        style={{
          background: 'linear-gradient(to right bottom, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0))'
        }} 
      />

      {/* Spotlight Hover Glow (Spectral Cyan) */}
      <motion.div
        animate={{ opacity }}
        transition={{ duration: 0.3 }}
        className="pointer-events-none absolute -inset-px rounded-[16px] z-10 transition-opacity duration-300"
        style={{
          background: `radial-gradient(450px circle at ${position.x}px ${position.y}px, rgba(0, 240, 255, 0.18), transparent 45%)`,
        }}
      />

      {/* Inner Surface: Smoked Obsidian Glass */}
      <div className="relative z-20 h-full w-full rounded-[15px] bg-[#0D1017]/85 backdrop-blur-2xl border border-white/[0.06] shadow-[0_16px_40px_rgba(0,0,0,0.7)]">
        {children}
      </div>
    </motion.div>
  );
}
