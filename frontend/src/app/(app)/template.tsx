'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useVariants } from '@/lib/motion';

/** True once any page has been shown in this tab: later navigations animate, the first load does not. */
let hasShownPage = false;

/**
 * Page transition. A template re-mounts on every navigation, so page content fades in with a
 * slight rise and a blur-to-sharp while the sidebar and top bar (in layout.tsx) stay still.
 * The very first load skips the entrance so server-rendered content is visible before hydration.
 * Content is interactive immediately; the animation never blocks clicks.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  const variants = useVariants('pageEnter');
  const [animateIn] = useState(() => typeof window !== 'undefined' && hasShownPage);

  useEffect(() => {
    hasShownPage = true;
  }, []);

  return (
    <motion.div variants={variants} initial={animateIn ? 'hidden' : false} animate="visible">
      {children}
    </motion.div>
  );
}
