'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'

interface BentoCardProps {
  icon: LucideIcon
  title: string
  description: string
  href: string
  delay?: number
}

export function BentoCard({ icon: Icon, title, description, href, delay = 0 }: BentoCardProps) {
  return (
    <Link href={href} className="block w-full h-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.5 }}
        whileHover={{ scale: 1.02, boxShadow: '0 0 24px rgba(0,240,255,0.25)' }}
        className="w-full h-full p-[1px] rounded-[16px] bg-[linear-gradient(to_right_bottom,rgba(0,240,255,0.2),rgba(255,255,255,0.04),rgba(0,0,0,0))] transition-all duration-300"
      >
        <div className="w-full h-full rounded-[15px] bg-[#07080B]/90 border border-white/[0.06] backdrop-blur-[12px] p-6 flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#00F0FF]/10 border border-[#00F0FF]/25 shadow-[0_0_12px_rgba(0,240,255,0.15)] mb-6">
              <Icon size={22} className="text-[#00F0FF]" />
            </div>
            <h3 className="font-display text-lg font-semibold text-white tracking-wide mt-4">{title}</h3>
            <p className="text-sm text-zinc-400 mt-2 leading-relaxed font-sans font-light">{description}</p>
          </div>
          <div className="mt-8 flex items-center gap-1.5 text-[#00F0FF] text-xs font-mono uppercase tracking-widest font-medium">
            Explore Module &rarr;
          </div>
        </div>
      </motion.div>
    </Link>
  )
}
