'use client';

import React from 'react';
import { motion, Variants } from 'framer-motion';
import { formatCurrency } from '@/lib/formatters';
import { Package, ArrowUpRight, TrendingUp } from 'lucide-react';

interface ProductData {
  name: string;
  value: number;
  quantity_sold?: number;
  category?: string;
  growth?: number;
}

export default function TopProducts({ 
  products,
  metricName = 'Revenue'
}: { 
  products: ProductData[];
  metricName?: string;
}) {
  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const item: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 350, damping: 26 } }
  };

  const maxValue = Math.max(...products.map(p => p.value || 0), 1);

  return (
    <div className="relative p-6 h-full flex flex-col justify-between overflow-hidden">
      
      {/* Card Header */}
      <div className="relative z-10 flex items-center justify-between mb-5 border-b border-white/[0.06] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00E599] shadow-[0_0_8px_#00E599]" />
            <h3 className="font-display text-base font-semibold tracking-wide text-white">
              Top Sellers & Nodes
            </h3>
          </div>
          <p className="text-[11px] font-mono text-white/50 mt-0.5">
            Velocity ranking by aggregate {metricName.toLowerCase()}
          </p>
        </div>

        <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#00E599]/10 border border-[#00E599]/25 text-[#00E599]">
          TOP {products.length}
        </span>
      </div>
      
      {/* Product List */}
      <motion.div 
        className="space-y-3 flex-grow relative z-10"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {products.map((product: ProductData, idx: number) => {
          const pct = Math.min(100, (product.value / maxValue) * 100);
          
          return (
            <motion.div 
              key={product.name || idx} 
              variants={item}
              whileHover={{ scale: 1.01, x: 2 }}
              className="group relative p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] hover:border-[#00F0FF]/30 transition-all duration-200 overflow-hidden"
            >
              {/* Background Volume Indicator Bar */}
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#00F0FF]/10 to-transparent pointer-events-none transition-all duration-500 opacity-40 group-hover:opacity-80"
                style={{ width: `${pct}%` }}
              />

              <div className="relative z-10 flex items-center justify-between gap-3">
                {/* Rank + Name + Category */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs font-bold text-white/30 group-hover:text-[#00F0FF] transition-colors w-5">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate group-hover:text-[#00F0FF] transition-colors">
                      {product.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 font-mono text-[11px] text-white/40">
                      {product.category && (
                        <span>{product.category}</span>
                      )}
                      {product.quantity_sold !== undefined && (
                        <>
                          <span>•</span>
                          <span>{product.quantity_sold.toLocaleString()} units</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Metric Value & Growth */}
                <div className="text-right flex-shrink-0 font-mono">
                  <div className="text-sm font-bold text-white group-hover:text-[#00F0FF] transition-colors tabular-nums">
                    {typeof product.value === 'number' ? formatCurrency(product.value) : product.value}
                  </div>
                  {product.growth !== undefined && (
                    <div className="flex items-center justify-end gap-1 text-[10px] text-[#00E599] font-medium mt-0.5">
                      <TrendingUp className="w-3 h-3" />
                      <span>+{product.growth}%</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}

        {products.length === 0 && (
          <div className="text-center py-8 font-mono text-xs text-white/40">
            No product velocity data indexed
          </div>
        )}
      </motion.div>

    </div>
  );
}
