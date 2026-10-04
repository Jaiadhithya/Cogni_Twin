'use client';

import { useRef } from 'react';
import { motion, useInView, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { duration, ease, useMediaQuery, usePrefersReducedMotion } from '@/lib/motion';
import { ProductWindow } from './product-window';

const WORDS_PLAIN = ['Run', 'your', 'business'];
const WORDS_GRADIENT = ['ahead', 'of', 'time.'];

/** Words reveal in a stagger with a slight blur-in. Reduced motion: plain fade. */
function Word({ children, index, gradient, reduced }: { children: string; index: number; gradient?: boolean; reduced: boolean }) {
  return (
    <motion.span
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, filter: 'blur(10px)' }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: reduced ? duration.standard : duration.hero, ease: ease.out, delay: reduced ? 0 : 0.12 + index * 0.09 }}
      className={gradient ? 'text-gradient-brand inline-block' : 'inline-block'}
    >
      {children}
    </motion.span>
  );
}

/** The hero: eyebrow, huge headline, subtext, CTAs and the tilting product window. */
export function Hero() {
  const reduced = usePrefersReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const inView = useInView(stageRef, { amount: 0.1 });
  // Mouse tilt is for desktop pointers only (not touch, not narrow screens).
  const finePointer = useMediaQuery('(pointer: fine) and (min-width: 1024px)');

  const tiltOn = finePointer && !reduced && inView;
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-5, 5]), { stiffness: 120, damping: 20 });
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [4, -4]), { stiffness: 120, damping: 20 });

  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!tiltOn) return;
    const rect = event.currentTarget.getBoundingClientRect();
    px.set((event.clientX - rect.left) / rect.width - 0.5);
    py.set((event.clientY - rect.top) / rect.height - 0.5);
  };
  const onLeave = () => {
    px.set(0);
    py.set(0);
  };

  // Ambient motion runs only while the hero is on screen and the user has not asked for less.
  const ambient = inView && !reduced;

  return (
    <section className="relative px-4 pb-20 pt-10 sm:px-6 lg:px-8 lg:pb-28 lg:pt-16" aria-labelledby="hero-title">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <motion.span
            initial={{ opacity: 0, y: reduced ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration.emphasis, ease: ease.out }}
            className="t-eyebrow inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-tint px-4 py-2 text-accent-ink"
          >
            <Sparkles aria-hidden className="size-3.5" strokeWidth={1.75} />
            A digital twin for your business
          </motion.span>

          <h1 id="hero-title" className="t-display mt-6">
            <span className="sr-only">Run your business ahead of time.</span>
            <span aria-hidden>
              {WORDS_PLAIN.map((w, i) => (
                <span key={w}>
                  <Word index={i} reduced={reduced}>{w}</Word>{' '}
                </span>
              ))}
              <br className="hidden sm:block" />
              <span style={{ animation: 'hue-drift 9s ease-in-out infinite', animationPlayState: ambient ? 'running' : 'paused' }} className="inline-block">
                {WORDS_GRADIENT.map((w, i) => (
                  <span key={w}>
                    <Word index={i + WORDS_PLAIN.length} gradient reduced={reduced}>{w}</Word>{' '}
                  </span>
                ))}
              </span>
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: reduced ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration.emphasis, ease: ease.out, delay: reduced ? 0 : 0.55 }}
            className="mt-6 max-w-xl text-lg text-ink-2"
          >
            Upload your sales data and CogniTwin builds a living model of your shop: what is happening, what is coming, and what would happen if you changed your prices.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration.emphasis, ease: ease.out, delay: reduced ? 0 : 0.7 }}
            className="mt-9 flex flex-wrap gap-3"
          >
            <ButtonLink href="/dashboard" variant="cta" size="lg" arrow>
              Open dashboard
            </ButtonLink>
            <ButtonLink href="#how-it-works" variant="secondary" size="lg">
              See how it works
            </ButtonLink>
          </motion.div>
        </div>

        <div ref={stageRef} onPointerMove={onMove} onPointerLeave={onLeave} className="[perspective:1400px]">
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.97 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: reduced ? duration.standard : duration.hero, ease: ease.out, delay: reduced ? 0 : 0.35 }}
          >
            <motion.div style={tiltOn ? { rotateX, rotateY, transformStyle: 'preserve-3d' } : undefined}>
              <div style={{ animation: 'float-slow 7s ease-in-out infinite', animationPlayState: ambient ? 'running' : 'paused' }}>
                <ProductWindow />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
