import {
  Compass,
  Database,
  FileText,
  GitCompare,
  LayoutDashboard,
  Settings,
  Sparkles,
  TrendingUp,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  { label: 'Overview', items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'Plan',
    items: [
      { href: '/forecast', label: 'Forecast & What-If', icon: TrendingUp },
      { href: '/scenarios', label: 'Scenarios', icon: GitCompare },
    ],
  },
  {
    label: 'Understand',
    items: [
      { href: '/ask', label: 'Ask AI', icon: Sparkles },
      { href: '/explorer', label: 'Data Explorer', icon: Compass },
    ],
  },
  {
    label: 'Data',
    items: [
      { href: '/datasets', label: 'Datasets', icon: Database },
      { href: '/documents', label: 'Documents', icon: FileText },
      { href: '/upload', label: 'Upload', icon: UploadCloud },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { href: '/settings', label: 'Settings', icon: Settings };

export const ALL_NAV_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];

/** Title for the top bar: the nav label of the current section. */
export function titleForPath(pathname: string): string {
  const match = ALL_NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  if (match) return match.label;
  if (pathname.startsWith('/query')) return 'Ask AI';
  if (pathname.startsWith('/ingest')) return 'Upload';
  return 'CogniTwin';
}

export function isActivePath(pathname: string, href: string): boolean {
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  // The legacy routes that Phase 2 renames.
  return (href === '/ask' && pathname.startsWith('/query')) || (href === '/upload' && pathname.startsWith('/ingest'));
}
