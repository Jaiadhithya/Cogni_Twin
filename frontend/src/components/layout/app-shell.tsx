'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Dialog as RadixDialog } from 'radix-ui';
import { useReturnFocus } from '@/lib/use-return-focus';
import { Sidebar, SidebarNav } from './sidebar';
import { TopBar } from './top-bar';

/**
 * The product window: left sidebar (rail on tablet, drawer on mobile), top bar, and the
 * content area. The sidebar and top bar stay still while page content transitions.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const returnFocus = useReturnFocus();
  const [drawer, setDrawer] = useState<{ open: boolean; path: string }>({ open: false, path: pathname });
  // The drawer closes itself when the route changes.
  const drawerOpen = drawer.open && drawer.path === pathname;

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-cta focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <Sidebar />

      <RadixDialog.Root open={drawerOpen} onOpenChange={(open) => setDrawer({ open, path: pathname })}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-200 md:hidden" />
          <RadixDialog.Content
            {...returnFocus}
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-border bg-surface-solid shadow-menu outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left duration-300 md:hidden"
          >
            <RadixDialog.Title className="sr-only">Navigation menu</RadixDialog.Title>
            <SidebarNav indicatorId="sidebar-active-drawer" onNavigate={() => setDrawer({ open: false, path: pathname })} />
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>

      <div className="md:pl-[72px] lg:pl-60">
        <TopBar onOpenMenu={() => setDrawer({ open: true, path: pathname })} />
        <main id="main" tabIndex={-1} className="mx-auto max-w-[1400px] px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
