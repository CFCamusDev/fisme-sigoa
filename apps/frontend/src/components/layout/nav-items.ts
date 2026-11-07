import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, ShieldCheck, Users } from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon?: LucideIcon;
  permission?: string;
}

export const MAIN_NAV_ITEMS: readonly NavItem[] = [
  {
    title: 'Panel',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Usuarios',
    href: '/usuarios',
    icon: Users,
    permission: 'usuario.ver',
  },
  {
    title: 'Roles',
    href: '/roles',
    icon: ShieldCheck,
    permission: 'rol.ver',
  },
] as const;
