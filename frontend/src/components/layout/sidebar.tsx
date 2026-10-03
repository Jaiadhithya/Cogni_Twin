'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';
import { useActiveDataset } from '@/lib/dataset-context';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { isActivePath, NAV_GROUPS, SETTINGS_ITEM, type NavItem } from './nav';

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" aria-label="CogniTwin home" className="flex items-center gap-2.5 rounded-control px-1 py-1 outline-offset-4">
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-primary text-white shadow-[0_4px_12px_rgb(59_130_246/0.35)]">
        <Layers className="size-[18px]" strokeWidth={2} />
      </span>
      <span className={cn('text-lg font-semibold tracking-[-0.02em] text-ink', compact && 'lg:inline md:hidden')}>CogniTwin</span>
    </Link>
  );
}

interface NavLinkProps {
  item: NavItem;
  active: boolean;
  href: string;
  /** Icons only (tablet rail). */
  collapsed: boolean;
  onNavigate?: () => void;
  indicatorId: string;
}

function NavLink({ item, active, href, collapsed, onNavigate, indicatorId }: NavLinkProps) {
  const Icon = item.icon;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        'relative flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors duration-[140ms]',
        collapsed && 'md:justify-center md:px-0 lg:justify-start lg:px-3',
        active ? 'text-primary-ink' : 'text-ink-2 hover:bg-black/[0.04] hover:text-ink',
      )}
    >
      {active && (
        <motion.span layoutId={indicatorId} transition={spring} className="absolute inset-0 rounded-control bg-primary-tint">
          <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary" />
        </motion.span>
      )}
      <Icon aria-hidden className="relative size-[18px] shrink-0" strokeWidth={1.75} />
      <span className={cn('relative truncate', collapsed && 'md:sr-only lg:not-sr-only')}>{item.label}</span>
    </Link>
  );
}

export interface SidebarNavProps {
  /** Collapse to icons between md and lg. Always false in the mobile drawer. */
  collapsible?: boolean;
  onNavigate?: () => void;
  /** Unique id so the gliding indicator is not shared between the rail and the drawer. */
  indicatorId: string;
}

/** Logo, grouped navigation with a gliding active indicator, and Settings at the bottom. */
export function SidebarNav({ collapsible = false, onNavigate, indicatorId }: SidebarNavProps) {
  const pathname = usePathname();
  const { withDataset } = useActiveDataset();
  const collapsed = collapsible;

  return (
    <div className="flex h-full flex-col gap-6 px-3 py-5">
      <div className={cn('px-1', collapsed && 'md:flex md:justify-center lg:block')}>
        <Logo compact={collapsed} />
      </div>
      <nav aria-label="Primary" className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className={cn('t-label mb-1.5 px-3 text-xs uppercase tracking-[0.06em]', collapsed && 'md:sr-only lg:not-sr-only')}>{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    item={item}
                    active={isActivePath(pathname, item.href)}
                    href={withDataset(item.href)}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                    indicatorId={indicatorId}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-border pt-3">
        <NavLink
          item={SETTINGS_ITEM}
          active={isActivePath(pathname, SETTINGS_ITEM.href)}
          href={withDataset(SETTINGS_ITEM.href)}
          collapsed={collapsed}
          onNavigate={onNavigate}
          indicatorId={indicatorId}
        />
      </div>
    </div>
  );
}

/** Fixed rail: 240px on desktop, icons only on tablet, hidden on mobile (the drawer replaces it). */
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[72px] border-r border-border bg-surface backdrop-blur-xl md:block lg:w-60">
      <SidebarNav collapsible indicatorId="sidebar-active-rail" />
    </aside>
  );
}
