'use client';

import React from 'react';
import { motion, Variants } from 'framer-motion';
import { formatCurrency } from '@/legacy/lib/formatters';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductData {
  name: string;
  value: number;
  quantity_sold?: number;
  category?: string;
  growth?: number;
}

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.36, ease: [0.16, 1, 0.3, 1] } },
};

export default function TopProducts({
  products,
  metricName = 'Revenue',
}: {
  products: ProductData[];
  metricName?: string;
}) {
  const maxValue = Math.max(...products.map((p) => p.value || 0), 1);

  return (
    <div className="flex h-full flex-col justify-between overflow-hidden p-6">
      <div className="mb-5 flex items-center justify-between border-b border-hairline pb-4">
        <div>
          <h3 className="text-h2 text-ink">Top sellers</h3>
          <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
            Ranked by aggregate {metricName.toLowerCase()}
          </p>
        </div>
        <span className="chip">Top {products.length}</span>
      </div>

      <motion.div
        className="flex-grow space-y-2.5"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {products.map((product, idx) => {
          const pct = Math.min(100, (product.value / maxValue) * 100);
          return (
            <motion.div
              key={product.name || idx}
              variants={item}
              className="group relative overflow-hidden rounded-[var(--r-md)] border border-hairline bg-graphite-900/60 p-3.5 transition-colors duration-[var(--dur-base)] hover:border-hairline-strong"
            >
              {/* Value bar — amber, proportional */}
              <div
                className="pointer-events-none absolute inset-y-0 left-0 bg-signal/12 transition-[width] duration-700 ease-out group-hover:bg-signal/18"
                style={{ width: `${pct}%` }}
                aria-hidden="true"
              />

              <div className="relative flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-5 font-mono text-xs font-semibold text-ink-muted tabular-nums">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{product.name}</p>
                    <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-ink-muted">
                      {product.category && <span>{product.category}</span>}
                      {product.category && product.quantity_sold !== undefined && (
                        <span aria-hidden="true">·</span>
                      )}
                      {product.quantity_sold !== undefined && (
                        <span>{product.quantity_sold.toLocaleString()} units</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0 text-right">
                  <div className="font-mono text-sm font-semibold tabular-nums text-ink">
                    {typeof product.value === 'number' ? formatCurrency(product.value) : product.value}
                  </div>
                  {product.growth !== undefined && (
                    <div
                      className={cn(
                        'mt-0.5 flex items-center justify-end gap-1 font-mono text-[10px] font-medium',
                        product.growth >= 0 ? 'text-positive' : 'text-negative'
                      )}
                    >
                      <TrendingUp className="h-3 w-3" />
                      <span>
                        {product.growth >= 0 ? '+' : ''}
                        {product.growth}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}

        {products.length === 0 && (
          <div className="py-8 text-center text-sm text-ink-muted">
            No product velocity data indexed.
          </div>
        )}
      </motion.div>
    </div>
  );
}
