'use client';

import { motion } from 'framer-motion';
import { useVariants } from '@/lib/motion';

/**
 * Page transition. A template re-mounts on every navigation, so page content fades in with a
 * slight rise and a blur-to-sharp while the sidebar and top bar (in layout.tsx) stay still.
 * Content is interactive immediately; the animation never blocks clicks.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  const variants = useVariants('pageEnter');
  return (
    <motion.div variants={variants} initial="hidden" animate="visible">
      {children}
    </motion.div>
  );
}
