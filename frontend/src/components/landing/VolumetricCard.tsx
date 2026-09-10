'use client'

import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface VolumetricCardProps {
  title: string
  description: string
  icon?: React.ReactNode
  isActive?: boolean
  onClick?: () => void
}

export function VolumetricCard({ title, description, icon, isActive, onClick }: VolumetricCardProps) {
  const divRef = useRef<HTMLDivElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [opacity, setOpacity] = useState(0)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current || isFocused) return

    const div = divRef.current
    const rect = div.getBoundingClientRect()

    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const handleFocus = () => {
    setIsFocused(true)
    setOpacity(1)
  }

  const handleBlur = () => {
    setIsFocused(false)
    setOpacity(0)
  }

  const handleMouseEnter = () => {
    setOpacity(1)
  }

  const handleMouseLeave = () => {
    setOpacity(0)
  }

  return (
    <div
      ref={divRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full overflow-hidden rounded-[16px] p-[1px] transition-transform duration-300 cursor-pointer ${
        isActive ? 'scale-[1.02]' : 'hover:scale-[1.01]'
      }`}
    >
      {/* Outer Shell Gradient */}
      <div 
        className="absolute inset-0 z-0 transition-opacity duration-500" 
        style={{
          background: isActive 
            ? 'linear-gradient(to right bottom, rgba(0, 240, 255, 0.4), rgba(0, 240, 255, 0.08), rgba(0, 0, 0, 0))' 
            : 'linear-gradient(to right bottom, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0))'
        }} 
      />

      {/* Spotlight Hover Glow */}
      <motion.div
        animate={{ opacity }}
        transition={{ duration: 0.3 }}
        className="pointer-events-none absolute -inset-px rounded-[16px] z-10 transition-opacity duration-300"
        style={{
          background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, rgba(0, 240, 255, 0.18), transparent 45%)`,
        }}
      />

      {/* Inner Surface */}
      <div className="relative z-20 h-full w-full rounded-[15px] bg-[#07080B]/90 border border-white/[0.06] backdrop-blur-xl flex items-center px-6 py-5 gap-4">
        {icon && (
          <div className={`p-2.5 rounded-lg transition-colors border ${isActive ? 'bg-[#00F0FF]/10 text-[#00F0FF] border-[#00F0FF]/30 shadow-[0_0_12px_rgba(0,240,255,0.2)]' : 'bg-white/[0.03] text-zinc-400 border-white/[0.06]'}`}>
            {icon}
          </div>
        )}
        <div className="flex flex-col">
          <h3 className={`text-[15px] font-display font-medium tracking-wide mb-1 transition-colors ${isActive ? 'text-white' : 'text-zinc-200'}`}>
            {title}
          </h3>
          <p className="text-[13px] font-light text-zinc-400 max-w-[320px] leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  )
}
