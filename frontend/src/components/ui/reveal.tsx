'use client';

import { motion } from 'framer-motion';
import { useVariants } from '@/lib/motion';

type DivProps = Omit<React.ComponentProps<typeof motion.div>, 'variants' | 'initial' | 'animate'>;

/**
 * Staggered reveal: put RevealItem children inside a RevealGroup and they rise in sequence
 * (KPI cards, then charts, then secondary cards). Under reduced motion they simply fade.
 */
export function RevealGroup(props: DivProps) {
  const variants = useVariants('staggerContainer');
  return <motion.div variants={variants} initial="hidden" animate="visible" {...props} />;
}

export function RevealItem(props: DivProps) {
  const variants = useVariants('staggerItem');
  return <motion.div variants={variants} {...props} />;
}

/** Fade + rise (+ blur-to-sharp) for a single block, outside a group. */
export function FadeBlur(props: DivProps) {
  const variants = useVariants('fadeBlur');
  return <motion.div variants={variants} initial="hidden" animate="visible" {...props} />;
}
