export interface NavItem {
  title: string;
  href: string;
  icon?: string;
  permission?: string;
}

export const MAIN_NAV_ITEMS: readonly NavItem[] = [
  {
    title: 'Panel',
    href: '/',
  },
] as const;
