'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCursor } from '@/components/context/CursorContext';

interface Spark {
  id: number;
  x: number;
  y: number;
}

export default function CustomCursor() {
  const { cursorTarget } = useCursor();
  const [sparks, setSparks] = useState<Spark[]>([]);
  const sparkIdCounter = useRef(0);
  const lastSparkTime = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMouseMove = (e: MouseEvent) => {
      // Throttle sparks slightly (e.g., max 1 spark per 16ms, or every ~1 frame)
      const now = performance.now();
      if (now - lastSparkTime.current > 20) {
        setSparks((prev) => {
          // Keep a maximum of 20 sparks to prevent DOM bloat
          const newSparks = [...prev, {
            id: sparkIdCounter.current++,
            x: e.clientX + window.scrollX,
            y: e.clientY + window.scrollY
          }];
          return newSparks.slice(-20);
        });
        lastSparkTime.current = now;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const removeSpark = (id: number) => {
    setSparks((prev) => prev.filter((s) => s.id !== id));
  };

  const isMagnetic = cursorTarget !== null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[9999] overflow-hidden">
      {/* 1. The Magnetic Snap Highlight */}
      <AnimatePresence>
        {isMagnetic && cursorTarget && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{
              opacity: 1,
              scale: 1,
              x: cursorTarget.left,
              y: cursorTarget.top,
              width: cursorTarget.width,
              height: cursorTarget.height,
              borderRadius: cursorTarget.borderRadius ?? 12,
            }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 25,
            }}
            className="absolute bg-[#00F0FF]/15 border border-[#00F0FF]/30 shadow-[0_0_20px_rgba(0,240,255,0.25)] pointer-events-none z-[9998]"
          />
        )}
      </AnimatePresence>

      {/* 2. The Lightning Spark Particle Trail */}
      {sparks.map((spark) => {
        const targetX = spark.x + (Math.random() * 20 - 10);
        const targetY = spark.y + 15 + (Math.random() * 10);

        return (
          <motion.div
            key={spark.id}
            initial={{ opacity: 1, scale: 1, x: spark.x, y: spark.y }}
            animate={{ opacity: 0, scale: 0, x: targetX, y: targetY }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            onAnimationComplete={() => removeSpark(spark.id)}
            className="absolute w-1.5 h-1.5 bg-[#00F0FF] rounded-full shadow-[0_0_10px_2px_rgba(0,240,255,0.8)] pointer-events-none mix-blend-screen z-[9999]"
            style={{ marginLeft: -3, marginTop: -3 }}
          />
        );
      })}
    </div>
  );
}
