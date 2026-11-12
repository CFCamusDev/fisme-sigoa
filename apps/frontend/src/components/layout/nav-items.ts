import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  CalendarRange,
  LayoutDashboard,
  ListChecks,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-react';

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
  {
    title: 'Programa',
    href: '/configuracion/programa',
    icon: Building2,
    permission: 'parametro.ver',
  },
  {
    title: 'Semestres',
    href: '/configuracion/semestres',
    icon: CalendarRange,
    permission: 'parametro.ver',
  },
  {
    title: 'Parámetros',
    href: '/configuracion/parametros',
    icon: SlidersHorizontal,
    permission: 'parametro.ver',
  },
  {
    title: 'Escalas',
    href: '/configuracion/escalas',
    icon: ListChecks,
    permission: 'parametro.ver',
  },
] as const;
