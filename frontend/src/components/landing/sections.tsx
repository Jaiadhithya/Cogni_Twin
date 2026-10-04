'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Layers, Lightbulb, MessageSquare, SlidersHorizontal, TrendingUp, UploadCloud, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { ButtonLink } from '@/components/ui/button';
import { duration, ease, staggerDelay, usePrefersReducedMotion } from '@/lib/motion';

const FEATURES: Array<{ icon: LucideIcon; title: string; body: string; href: string }> = [
  { icon: TrendingUp, title: 'Forecast', body: 'See the next 30 to 90 days of sales, with honest ranges that show how sure the model is.', href: '/forecast' },
  { icon: SlidersHorizontal, title: 'What-if', body: 'Raise a price or cut marketing and see the effect on sales, profit and the best price to charge.', href: '/forecast' },
  { icon: MessageSquare, title: 'Ask AI', body: 'Ask in plain English, “which products grew last month?”, and get an answer with charts.', href: '/ask' },
  { icon: Lightbulb, title: 'Recommendations', body: 'Get a short list of prioritised actions, each with its expected impact and timing.', href: '/dashboard' },
];

const STEPS: Array<{ icon: LucideIcon; title: string; body: string }> = [
  { icon: UploadCloud, title: 'Upload', body: 'Drop in a CSV of your sales. We find the dates, amounts and breakdowns for you.' },
  { icon: Layers, title: 'Twin', body: 'CogniTwin learns your patterns: weekends, festivals, price effects.' },
  { icon: Lightbulb, title: 'Decide', body: 'Plan stock, test prices and act on clear recommendations.' },
];

/** Fades and rises once when scrolled into view; a plain fade under reduced motion. */
function Reveal({ children, index = 0, className }: { children: React.ReactNode; index?: number; className?: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28 }}
      whileInView={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: reduced ? duration.standard : duration.emphasis, ease: ease.out, delay: reduced ? 0 : staggerDelay(index) }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1200px]">
        <Reveal>
          <p className="t-eyebrow text-primary-ink">What you get</p>
          <h2 id="features-title" className="mt-3 max-w-2xl text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
            Everything a shop owner needs to look ahead
          </h2>
        </Reveal>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body, href }, i) => (
            <li key={title}>
              <Reveal index={i} className="h-full">
                <Link
                  href={href}
                  className="glass group flex h-full flex-col rounded-card p-6 outline-none transition-[transform,box-shadow,border-color] duration-[160ms] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98]"
                >
                  <span aria-hidden className="grid size-11 place-items-center rounded-control bg-primary-tint text-primary-ink">
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <h3 className="t-h2 mt-5">{title}</h3>
                  <p className="mt-2 flex-1 text-[15px] text-ink-2">{body}</p>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary-ink">
                    Try it <ArrowRight aria-hidden className="size-4 transition-transform duration-[140ms] group-hover:translate-x-0.5" strokeWidth={1.75} />
                  </span>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1200px]">
        <Reveal>
          <p className="t-eyebrow text-primary-ink">How it works</p>
          <h2 id="how-title" className="mt-3 text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
            Upload. Twin. Decide.
          </h2>
        </Reveal>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title}>
              <Reveal index={i} className="h-full">
                <div className="glass relative h-full rounded-card p-6">
                  <span className="absolute right-6 top-5 text-5xl font-semibold tabular-nums text-black/[0.05]" aria-hidden>
                    {i + 1}
                  </span>
                  <span aria-hidden className="grid size-11 place-items-center rounded-full bg-cta text-white">
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <h3 className="t-h2 mt-5">
                    <span className="sr-only">Step {i + 1}: </span>
                    {title}
                  </h3>
                  <p className="mt-2 text-[15px] text-ink-2">{body}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
        <Reveal className="mt-12 flex justify-center">
          <ButtonLink href="/upload" variant="cta" size="lg" arrow>
            Upload your sales data
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-sm text-ink-3">
        <p>© {new Date().getFullYear()} CogniTwin. Decision support for small and mid-sized retail businesses in India.</p>
        <nav aria-label="Footer" className="flex gap-5">
          <Link href="/dashboard" className="hover:text-ink">Dashboard</Link>
          <Link href="/upload" className="hover:text-ink">Upload</Link>
          <Link href="/settings" className="hover:text-ink">Settings</Link>
        </nav>
      </div>
    </footer>
  );
}
