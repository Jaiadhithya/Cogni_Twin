'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layers } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
];

/** The same floating glass pill as the app: logo, a few section links, "Open dashboard" on the right. */
export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <header className="pointer-events-none sticky top-0 z-40 px-3 pt-3 sm:px-4 sm:pt-4">
      <nav
        aria-label="Main"
        className={cn(
          'glass pointer-events-auto mx-auto flex w-full max-w-[1120px] items-center gap-1 rounded-full px-2.5 shadow-card-hover transition-[height] duration-[240ms]',
          scrolled ? 'h-12 [--glass-bg:var(--color-surface-strong)]' : 'h-14',
        )}
      >
        <Link href="/" aria-label="CogniTwin home" className="mr-2 flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-2 outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-primary text-white">
            <Layers className="size-[17px]" strokeWidth={2} />
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink">CogniTwin</span>
        </Link>
        <div className="hidden items-center gap-0.5 sm:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-3.5 py-2 text-sm font-medium text-ink-2 outline-none transition-colors hover:bg-black/[0.04] hover:text-ink focus-visible:ring-2 focus-visible:ring-primary">
              {l.label}
            </a>
          ))}
        </div>
        <div className="ml-auto">
          <ButtonLink href="/dashboard" variant="cta" size="sm" arrow>
            Open dashboard
          </ButtonLink>
        </div>
      </nav>
    </header>
  );
}
