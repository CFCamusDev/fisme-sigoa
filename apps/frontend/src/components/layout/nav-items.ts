import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  BookMarked,
  Building2,
  CalendarClock,
  CalendarRange,
  ClipboardList,
  FileCheck,
  FileText,
  LayoutDashboard,
  ListChecks,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  UsersRound,
  Workflow,
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
  {
    title: 'Catálogo',
    href: '/catalogo/versiones',
    icon: BookMarked,
    permission: 'catalogo.ver',
  },
  {
    title: 'Resoluciones',
    href: '/resoluciones',
    icon: FileCheck,
    permission: 'resolucion.ver',
  },
  {
    title: 'Plantillas',
    href: '/plantillas',
    icon: FileText,
    permission: 'plantilla.ver',
  },
  {
    title: 'Constituyentes',
    href: '/constituyentes',
    icon: UsersRound,
    permission: 'constituyente.ver',
  },
  {
    title: 'Listas Anexo 3',
    href: '/listas-constituyentes',
    icon: ClipboardList,
    permission: 'constituyente.ver',
  },
  {
    title: 'Comité de Calidad',
    href: '/comite-calidad',
    icon: BadgeCheck,
    permission: 'comite.ver',
  },
  {
    title: 'Ejecuciones',
    href: '/ejecuciones',
    icon: Workflow,
    permission: 'ejecucion.ver',
  },
  {
    title: 'Sesiones',
    href: '/sesiones',
    icon: CalendarClock,
    permission: 'sesion.ver',
  },
] as const;
