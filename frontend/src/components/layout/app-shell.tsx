'use client';

import { CommandPaletteProvider } from './command-palette';
import { DemoBadge } from './demo-badge';
import { NavPill } from './nav-pill';

/**
 * The app frame: a floating pill nav (sticky, glass) over scrolling content. Each page renders
 * its own PageHeader. The nav stays still while page content transitions.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <CommandPaletteProvider>
      <div className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-cta focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>
        <header className="pointer-events-none sticky top-0 z-40 px-3 pt-3 sm:px-4 sm:pt-4">
          <NavPill />
          <div className="pointer-events-auto mt-2 flex justify-center">
            <DemoBadge />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 outline-none sm:px-6 sm:pt-8 lg:px-8">
          {children}
        </main>
      </div>
    </CommandPaletteProvider>
  );
}
