'use client';

import React, { useEffect, useRef, useState } from 'react';

interface EnlargedThreadCanvasProps {
  styleIndex?: number;
  amplitude?: number;
  strandCount?: number;
}

export default function EnlargedThreadCanvas({
  styleIndex = 0,
  amplitude = 360,
  strandCount = 5,
}: EnlargedThreadCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.parentElement?.clientWidth || window.innerWidth || 1200;
    let height = canvas.parentElement?.clientHeight || window.innerHeight || 800;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth || 1200;
      height = canvas.height = canvas.parentElement?.clientHeight || window.innerHeight || 800;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    let time = 0;
    let mouse = {
      x: width * 0.5,
      y: height * 0.5,
      targetX: width * 0.5,
      targetY: height * 0.5,
    };

    interface Ripple {
      x: number;
      y: number;
      r: number;
      alpha: number;
    }
    let ripples: Ripple[] = [];

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.targetX = e.clientX - rect.left;
      mouse.targetY = e.clientY - rect.top;
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      ripples.push({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        r: 0,
        alpha: 1.0,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);

    // Precision Instrument palette: one amber signal carried by neutral
    // ink strands. Emerald/coral are reserved for data semantics and
    // never appear in chrome.
    const palette = [
      { color: 'rgba(255, 176, 32, 0.95)', glow: 'rgba(255, 176, 32, 0.55)' },
      { color: 'rgba(255, 200, 80, 0.85)', glow: 'rgba(255, 200, 80, 0.38)' },
      { color: 'rgba(201, 138, 12, 0.75)', glow: 'rgba(201, 138, 12, 0.30)' },
      { color: 'rgba(245, 243, 239, 0.45)', glow: 'rgba(245, 243, 239, 0.14)' },
    ];

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      mouse.x += (mouse.targetX - mouse.x) * 0.08;
      mouse.y += (mouse.targetY - mouse.y) * 0.08;
      time += 0.015;

      const pal = palette;
      const centerY = height * 0.54;

      // 1. Ambient Volumetric Glow
      const ambient = ctx.createRadialGradient(width * 0.55, centerY, 40, width * 0.55, centerY, width * 0.6);
      ambient.addColorStop(0, pal[0].glow.replace(/[\d\.]+\)$/, '0.14)'));
      ambient.addColorStop(0.5, pal[1].glow.replace(/[\d\.]+\)$/, '0.04)'));
      ambient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = ambient;
      ctx.fillRect(0, 0, width, height);

      // Ripple Pulses
      ripples.forEach((rp) => {
        rp.r += 12;
        rp.alpha *= 0.94;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
        ctx.strokeStyle = pal[0].color.replace(/[\d\.]+\)$/, `${rp.alpha})`);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
      ripples = ripples.filter((p) => p.alpha > 0.02);

      // 2. Render 3D Braided Vortex
      if (styleIndex === 0) {
        const step = 8;
        const count = Math.ceil(width / step);
        const strands = [];

        for (let s = 0; s < strandCount; s++) {
          const palColor = pal[s % pal.length];
          const phase = (s / strandCount) * Math.PI * 2;
          const pts = [];

          for (let i = 0; i <= count; i++) {
            const x = i * step;
            const t = x / width;
            const env = Math.sin(t * Math.PI);

            const angle = t * 4.0 * Math.PI + time + phase;
            const radius = amplitude * env * 0.85;

            const localY = Math.sin(angle) * radius;
            const localZ = Math.cos(angle) * radius;

            const sweep = Math.sin(t * 3.2 + time) * (amplitude * 0.35 * env);

            const dx = x - mouse.x;
            const dy = centerY + sweep + localY - mouse.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            let mDisp = 0;
            if (d < 350) {
              mDisp = Math.sin((1 - d / 350) * Math.PI) * 65;
            }

            for (const rp of ripples) {
              const rdx = x - rp.x;
              const rdy = centerY + sweep + localY - rp.y;
              const rDist = Math.sqrt(rdx * rdx + rdy * rdy);
              const diff = Math.abs(rDist - rp.r);
              if (diff < 60) {
                mDisp += Math.cos((diff / 60) * Math.PI * 0.5) * 35 * rp.alpha;
              }
            }

            const fov = 700;
            const scale = fov / (fov + localZ);
            const screenY = centerY + sweep + localY * scale + mDisp;

            pts.push({ x, y: screenY, z: localZ, scale });
          }

          const avgZ = pts.reduce((acc, p) => acc + p.z, 0) / pts.length;
          strands.push({ pts, color: palColor, avgZ, idx: s });
        }

        strands.sort((a, b) => a.avgZ - b.avgZ);

        strands.forEach((st) => {
          const pts = st.pts;
          ctx.beginPath();
          for (let i = 0; i < pts.length; i++) {
            if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
            else ctx.lineTo(pts[i].x, pts[i].y);
          }

          ctx.shadowColor = st.color.glow;
          ctx.shadowBlur = strandCount <= 6 ? 38 : 24;
          ctx.strokeStyle = st.color.color;
          ctx.lineWidth = (strandCount <= 6 ? 4.8 : 3.2) * (st.avgZ > 0 ? 1.25 : 0.75);
          ctx.stroke();

          if (st.avgZ > -25) {
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(245, 243, 239, 0.7)';
            ctx.lineWidth = strandCount <= 6 ? 1.2 : 0.8;
            ctx.stroke();
          }

          const prog = (time * 0.22 + st.idx * 0.12) % 1.0;
          const pIdx = Math.floor(prog * pts.length);
          if (pts[pIdx] && st.avgZ > -15) {
            ctx.beginPath();
            ctx.arc(pts[pIdx].x, pts[pIdx].y, (strandCount <= 6 ? 5.5 : 4.2) * pts[pIdx].scale, 0, Math.PI * 2);
            ctx.fillStyle = '#F5F3EF';
            ctx.shadowColor = st.color.color;
            ctx.shadowBlur = 24;
            ctx.fill();
          }
        });
      } else if (styleIndex === 1) {
        // Style 1: Luminous Silk
        const ribbonCount = Math.min(8, strandCount);
        const step = 8;
        const count = Math.ceil(width / step);

        for (let r = 0; r < ribbonCount; r++) {
          const palColor = pal[r % pal.length];
          const ribbonW = (strandCount <= 6 ? 65 : 35) + r * 15;
          const freq = 0.0012 + r * 0.0003;
          const phase = r * 0.9;

          const top: { x: number; y: number }[] = [];
          const bot: { x: number; y: number }[] = [];

          for (let i = 0; i <= count; i++) {
            const x = i * step;
            const env = Math.sin((x / width) * Math.PI);
            const w1 = Math.sin(x * freq + time * 1.2 + phase) * (amplitude * env);
            const w2 = Math.cos(x * freq * 1.7 - time * 0.8) * (amplitude * 0.3 * env);

            const d = Math.abs(x - mouse.x);
            let mDisp = 0;
            if (d < 300) {
              mDisp = (1 - d / 300) * 45 * Math.sin(time * 2);
            }

            const midY = centerY + w1 + w2 + mDisp;
            const halfW = ribbonW * 0.5 * env;

            top.push({ x, y: midY - halfW });
            bot.push({ x, y: midY + halfW });
          }

          ctx.beginPath();
          for (let i = 0; i < top.length; i++) {
            if (i === 0) ctx.moveTo(top[i].x, top[i].y);
            else ctx.lineTo(top[i].x, top[i].y);
          }
          for (let i = bot.length - 1; i >= 0; i--) {
            ctx.lineTo(bot[i].x, bot[i].y);
          }
          ctx.closePath();

          const grad = ctx.createLinearGradient(0, centerY - amplitude, 0, centerY + amplitude);
          grad.addColorStop(0, palColor.glow.replace(/[\d\.]+\)$/, '0.08)'));
          grad.addColorStop(0.5, palColor.glow.replace(/[\d\.]+\)$/, '0.22)'));
          grad.addColorStop(1, palColor.glow.replace(/[\d\.]+\)$/, '0.02)'));
          ctx.fillStyle = grad;
          ctx.fill();

          ctx.shadowColor = palColor.glow;
          ctx.shadowBlur = strandCount <= 6 ? 26 : 15;
          ctx.strokeStyle = palColor.color;
          ctx.lineWidth = strandCount <= 6 ? 2.4 : 1.5;
          ctx.stroke();
        }
      } else {
        // Style 2: Quantum Beam
        const step = 6;
        const count = Math.ceil(width / step);

        for (let s = 0; s < strandCount * 1.4; s++) {
          const palColor = pal[s % pal.length];
          const freq = 0.0016 + s * 0.0002;
          const speed = 0.025 + s * 0.003;
          const amp = amplitude * 0.6 + (s % 5) * 20;
          const phase = s * 0.45;

          ctx.beginPath();
          for (let i = 0; i <= count; i++) {
            const x = i * step;
            const env = Math.sin((x / width) * Math.PI);
            const y1 = Math.sin(x * freq + time * speed * 70 + phase) * (amp * env);
            const y2 = Math.sin(x * (freq * 2.6) - time * 1.5) * (25 * env);

            const d = Math.abs(x - mouse.x);
            let mDisp = 0;
            if (d < 280) {
              mDisp = (1 - d / 280) * 65 * Math.sin((x - mouse.x) * 0.02);
            }

            const y = centerY + y1 + y2 + mDisp;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }

          ctx.shadowColor = palColor.glow;
          ctx.shadowBlur = 18;
          ctx.strokeStyle = palColor.color;
          ctx.lineWidth = 1.3;
          ctx.stroke();

          if (s % 3 === 0) {
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(245, 243, 239, 0.65)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [styleIndex, amplitude, strandCount]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full z-0 cursor-default pointer-events-auto"
    />
  );
}
