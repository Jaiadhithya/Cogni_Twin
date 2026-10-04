'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronDown, Layers, Menu, Search } from 'lucide-react';
import { DropdownMenu, Tooltip } from 'radix-ui';
import { useActiveDataset } from '@/lib/dataset-context';
import { duration, ease, spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useCommandPalette } from './command-palette';
import { DatasetSelector } from './dataset-selector';
import { HealthDot } from './health-dot';
import { DATA_LINKS, isActivePath, isDataPath, PRIMARY_LINKS, SETTINGS_ITEM, type NavItem } from './nav';
import { NavSheet } from './nav-sheet';

/** True once the page has scrolled past `threshold` px. Only flips at the threshold. */
function useScrolled(threshold: number): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [threshold]);
  return scrolled;
}

const itemBase =
  'relative inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 text-sm font-medium outline-none transition-colors duration-[140ms] focus-visible:ring-2 focus-visible:ring-primary lg:px-3.5';

function ActivePill({ id }: { id: string }) {
  return <motion.span layoutId={id} transition={spring} className="absolute inset-0 rounded-full bg-primary-tint" />;
}

function IconTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={10}
          className="z-50 rounded-lg bg-cta px-2.5 py-1.5 text-xs font-medium text-white shadow-menu data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 lg:hidden"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function NavLink({ item, active, href, pillId }: { item: NavItem; active: boolean; href: string; pillId: string }) {
  const Icon = item.icon;
  return (
    <IconTip label={item.label}>
      <Link href={href} aria-current={active ? 'page' : undefined} aria-label={item.label} className={cn(itemBase, active ? 'text-primary-ink' : 'text-ink-2 hover:bg-black/[0.04] hover:text-ink')}>
        {active && <ActivePill id={pillId} />}
        <Icon aria-hidden className="relative size-[18px] shrink-0" strokeWidth={1.75} />
        <span className="relative hidden lg:inline">{item.label}</span>
      </Link>
    </IconTip>
  );
}

function DataMenu({ active, pillId, hrefFor }: { active: boolean; pillId: string; hrefFor: (href: string) => string }) {
  const pathname = usePathname();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={cn(itemBase, 'group', active ? 'text-primary-ink' : 'text-ink-2 hover:bg-black/[0.04] hover:text-ink data-[state=open]:bg-black/[0.04]')}>
        {active && <ActivePill id={pillId} />}
        <span className="relative">Data</span>
        <ChevronDown aria-hidden className="relative size-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" strokeWidth={1.75} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={12}
          className="z-50 w-80 origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-card border border-border bg-surface-solid p-2 shadow-menu data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 duration-200"
        >
          {DATA_LINKS.map((item) => {
            const Icon = item.icon;
            const current = isActivePath(pathname, item.href);
            return (
              <DropdownMenu.Item key={item.href} asChild>
                <Link
                  href={hrefFor(item.href)}
                  aria-current={current ? 'page' : undefined}
                  className="flex cursor-pointer items-start gap-3 rounded-panel p-3 outline-none data-[highlighted]:bg-primary-tint"
                >
                  <span aria-hidden className={cn('grid size-9 shrink-0 place-items-center rounded-control', current ? 'bg-primary text-white' : 'bg-primary-tint text-primary-ink')}>
                    <Icon className="size-[18px]" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{item.label}</span>
                    <span className="block text-xs text-ink-3">{item.description}</span>
                  </span>
                </Link>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/**
 * The floating glass pill that is the app's navigation: logo, primary links with a gliding
 * active indicator, a Data menu, dataset menu, health dot, search and settings. It compacts a
 * little once the page scrolls, and never hides. Mobile shows logo, health dot and a menu button.
 */
export function NavPill() {
  const pathname = usePathname();
  const { withDataset } = useActiveDataset();
  const palette = useCommandPalette();
  const compact = useScrolled(24);
  const [sheetOpen, setSheetOpen] = useState(false);
  const pillId = useId();
  const dataActive = isDataPath(pathname);

  return (
    <Tooltip.Provider delayDuration={150}>
      <motion.nav
        aria-label="Main"
        initial={false}
        animate={{ height: compact ? 48 : 56 }}
        transition={{ duration: duration.standard, ease: ease.state }}
        className={cn(
          'glass pointer-events-auto mx-auto flex w-full max-w-[1120px] items-center gap-1 rounded-full px-2.5 shadow-card-hover transition-[background-color] duration-[240ms]',
          compact && '[--glass-bg:var(--color-surface-strong)]',
        )}
      >
        <Link
          href={withDataset('/dashboard')}
          aria-label="CogniTwin dashboard"
          className="mr-1 flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-2 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-primary text-white">
            <Layers className="size-[17px]" strokeWidth={2} />
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink">CogniTwin</span>
        </Link>

        {/* Desktop and tablet */}
        <div className="hidden items-center gap-0.5 md:flex">
          {PRIMARY_LINKS.map((item) => (
            <NavLink key={item.href} item={item} active={isActivePath(pathname, item.href)} href={withDataset(item.href)} pillId={pillId} />
          ))}
          <DataMenu active={dataActive} pillId={pillId} hrefFor={withDataset} />
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <span aria-hidden className="mx-1.5 hidden h-5 w-px bg-border-strong md:block" />
          <div className="hidden md:block">
            <DatasetSelector />
          </div>
          <HealthDot />
          <div className="hidden items-center md:flex">
            <IconTip label="Search (Ctrl K)">
              <button
                type="button"
                onClick={palette.open}
                aria-label="Search and commands"
                className={cn(itemBase, 'gap-2 px-2.5 text-ink-2 hover:bg-black/[0.04] hover:text-ink')}
              >
                <Search aria-hidden className="size-[18px]" strokeWidth={1.75} />
                <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-ink-3 xl:block">Ctrl K</kbd>
              </button>
            </IconTip>
            <IconTip label={SETTINGS_ITEM.label}>
              <Link
                href={withDataset(SETTINGS_ITEM.href)}
                aria-label={SETTINGS_ITEM.label}
                aria-current={isActivePath(pathname, SETTINGS_ITEM.href) ? 'page' : undefined}
                className={cn(itemBase, 'px-2.5', isActivePath(pathname, SETTINGS_ITEM.href) ? 'text-primary-ink' : 'text-ink-2 hover:bg-black/[0.04] hover:text-ink')}
              >
                {isActivePath(pathname, SETTINGS_ITEM.href) && <ActivePill id={pillId} />}
                <SETTINGS_ITEM.icon aria-hidden className="relative size-[18px]" strokeWidth={1.75} />
              </Link>
            </IconTip>
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Open menu"
            className="grid size-9 place-items-center rounded-full text-ink-2 outline-none transition-colors hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-primary md:hidden"
          >
            <Menu aria-hidden className="size-5" strokeWidth={1.75} />
          </button>
        </div>
      </motion.nav>
      <NavSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </Tooltip.Provider>
  );
}
