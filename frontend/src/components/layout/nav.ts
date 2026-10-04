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
  description?: string;
}

/** Primary links in the pill. */
export const PRIMARY_LINKS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'What is happening in your business' },
  { href: '/forecast', label: 'Forecast', icon: TrendingUp, description: 'What is coming, and what-if scenarios' },
  { href: '/scenarios', label: 'Scenarios', icon: GitCompare, description: 'Compare saved what-ifs' },
  { href: '/ask', label: 'Ask AI', icon: Sparkles, description: 'Ask questions in plain English' },
];

/** Inside the "Data" menu. */
export const DATA_LINKS: NavItem[] = [
  { href: '/explorer', label: 'Data Explorer', icon: Compass, description: 'Columns, correlations and scatter plots' },
  { href: '/datasets', label: 'Datasets', icon: Database, description: 'Everything you have uploaded' },
  { href: '/documents', label: 'Documents', icon: FileText, description: 'Upload PDFs and search them' },
  { href: '/upload', label: 'Upload', icon: UploadCloud, description: 'Add a new CSV of sales data' },
];

export const SETTINGS_ITEM: NavItem = { href: '/settings', label: 'Settings', icon: Settings, description: 'Demo mode and preferences' };

/** Grouping used by the mobile sheet. */
export const SHEET_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  { label: 'Overview', items: [PRIMARY_LINKS[0]] },
  { label: 'Plan', items: [PRIMARY_LINKS[1], PRIMARY_LINKS[2]] },
  { label: 'Understand', items: [PRIMARY_LINKS[3], DATA_LINKS[0]] },
  { label: 'Data', items: [DATA_LINKS[1], DATA_LINKS[2], DATA_LINKS[3]] },
  { label: 'Settings', items: [SETTINGS_ITEM] },
];

export const ALL_NAV_ITEMS: NavItem[] = [...PRIMARY_LINKS, ...DATA_LINKS, SETTINGS_ITEM];

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isDataPath(pathname: string): boolean {
  return DATA_LINKS.some((item) => isActivePath(pathname, item.href));
}
