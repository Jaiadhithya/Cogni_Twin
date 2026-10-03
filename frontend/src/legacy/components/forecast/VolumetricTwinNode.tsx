'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface VolumetricTwinNodeProps {
  stressLevel?: number; // e.g. -10 to +10 percentage delta
  size?: number;
  className?: string;
  showReadout?: boolean;
}

export default function VolumetricTwinNode({
  stressLevel = 0,
  size = 72,
  className = '',
  showReadout = true,
}: VolumetricTwinNodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameId = useRef<number | null>(null);

  // Rotation angles
  const angleXRef = useRef(0);
  const angleYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Normalizing stress from delta (-1 to 1)
    const normalizedStress = Math.max(-1, Math.min(1, stressLevel / 15));

    // Geodesic 3D vertices for an icosahedron
    const phi = (1 + Math.sqrt(5)) / 2;
    const baseVertices = [
      [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
      [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
      [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
    ];
    const edges = [
      [0, 11], [0, 5], [0, 1], [0, 7], [0, 10], [1, 5], [1, 9], [1, 8], [1, 7],
      [2, 11], [2, 10], [2, 6], [2, 3], [2, 4], [3, 4], [3, 9], [3, 8], [3, 6],
      [4, 9], [4, 5], [4, 11], [5, 9], [6, 7], [6, 8], [6, 10], [7, 8], [8, 9], [10, 11]
    ];

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!isDraggingRef.current) {
        angleXRef.current += 0.012 + Math.abs(normalizedStress) * 0.015;
        angleYRef.current += 0.016;
      }

      const scale = (size * 0.32) + (normalizedStress * 3);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Color temperature modulation:
      // Cyan (#00F0FF) nominal -> Emerald (#00E599) surplus -> Coral (#FF4466) deficit
      let strokeColor = 'rgba(0, 240, 255, 0.85)';
      let glowColor = 'rgba(0, 240, 255, 0.3)';
      if (normalizedStress > 0.15) {
        strokeColor = 'rgba(0, 229, 153, 0.9)';
        glowColor = 'rgba(0, 229, 153, 0.4)';
      } else if (normalizedStress < -0.15) {
        strokeColor = 'rgba(255, 68, 102, 0.9)';
        glowColor = 'rgba(255, 68, 102, 0.4)';
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.4;

      const projected = baseVertices.map(([x, y, z]) => {
        // Rotate Y
        const x1 = x * Math.cos(angleYRef.current) + z * Math.sin(angleYRef.current);
        const z1 = -x * Math.sin(angleYRef.current) + z * Math.cos(angleYRef.current);
        // Rotate X
        const y2 = y * Math.cos(angleXRef.current) - z1 * Math.sin(angleXRef.current);
        const z2 = y * Math.sin(angleXRef.current) + z1 * Math.cos(angleXRef.current);
        return [cx + x1 * scale, cy + y2 * scale, z2];
      });

      // Draw wireframe edges
      edges.forEach(([i, j]) => {
        ctx.beginPath();
        ctx.moveTo(projected[i][0], projected[i][1]);
        ctx.lineTo(projected[j][0], projected[j][1]);
        ctx.stroke();
      });

      // Draw glowing vertices
      projected.forEach(([x, y]) => {
        ctx.fillStyle = strokeColor;
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      });

      animFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [stressLevel, size]);

  // Mouse / Touch interaction handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    setIsInteracting(true);
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    angleYRef.current += dx * 0.02;
    angleXRef.current += dy * 0.02;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    setIsInteracting(false);
  };

  const isSurplus = stressLevel > 5;
  const isDeficit = stressLevel < -5;

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* 3D Wireframe Canvas Container */}
      <div 
        className="relative rounded-xl bg-[#06090E]/90 border border-white/10 overflow-hidden flex items-center justify-center flex-shrink-0 cursor-grab active:cursor-grabbing shadow-[0_0_20px_rgba(0,0,0,0.6)]"
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        title="Drag to rotate 3D Volumetric Twin Node"
      >
        <canvas
          ref={canvasRef}
          width={size * 2}
          height={size * 2}
          className="w-full h-full"
        />
        <div 
          className="absolute inset-0 pointer-events-none rounded-xl transition-all duration-300 border"
          style={{
            borderColor: isSurplus 
              ? 'rgba(0, 229, 153, 0.35)' 
              : isDeficit 
              ? 'rgba(255, 68, 102, 0.35)' 
              : 'rgba(0, 240, 255, 0.3)',
            boxShadow: isSurplus
              ? '0 0 15px rgba(0, 229, 153, 0.2) inset'
              : isDeficit
              ? '0 0 15px rgba(255, 68, 102, 0.2) inset'
              : '0 0 15px rgba(0, 240, 255, 0.2) inset'
          }}
        />
      </div>

      {showReadout && (
        <div className="font-mono">
          <div className="font-display font-semibold text-xs text-white flex items-center gap-2">
            <span>VOLUMETRIC TWIN NODE</span>
            <span
              className="w-2 h-2 rounded-full transition-colors duration-300 animate-pulse"
              style={{
                backgroundColor: isSurplus ? '#00E599' : isDeficit ? '#FF4466' : '#00F0FF',
                boxShadow: `0 0 10px ${isSurplus ? '#00E599' : isDeficit ? '#FF4466' : '#00F0FF'}`
              }}
            />
          </div>
          <p className="text-[11px] text-white/50 tracking-tight mt-0.5">
            State:{' '}
            <span
              className="font-bold"
              style={{
                color: isSurplus ? '#00E599' : isDeficit ? '#FF4466' : '#00F0FF'
              }}
            >
              {isSurplus
                ? `EXPANSIVE SURPLUS (+${stressLevel.toFixed(1)}%)`
                : isDeficit
                ? `DEFICIT TENSION (${stressLevel.toFixed(1)}%)`
                : 'NOMINAL (STABLE)'}
            </span>
          </p>
          <div className="text-[10px] text-white/40 mt-0.5">
            RESONANCE: {(432 + stressLevel * 3.5).toFixed(1)} Hz • DRAG TO ROTATE
          </div>
        </div>
      )}
    </div>
  );
}
