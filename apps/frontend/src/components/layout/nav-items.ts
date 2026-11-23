import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  BookMarked,
  Building2,
  CalendarClock,
  CalendarRange,
  ClipboardList,
  FileCheck,
  FileDown,
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
  readonly title: string;
  readonly href: string;
  readonly icon?: LucideIcon;
  readonly permission?: string;
  readonly activeMatch?: readonly string[];
}

export interface NavGroup {
  readonly id: string;
  readonly title: string;
  readonly icon: LucideIcon;
  readonly items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'inicio',
    title: 'Inicio',
    icon: LayoutDashboard,
    items: [
      {
        title: 'Panel',
        href: '/',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: 'administracion',
    title: 'Administración',
    icon: ShieldCheck,
    items: [
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
    ],
  },
  {
    id: 'configuracion',
    title: 'Configuración',
    icon: SlidersHorizontal,
    items: [
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
    ],
  },
  {
    id: 'catalogo-documentos',
    title: 'Catálogo y documentos',
    icon: BookMarked,
    items: [
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
        title: 'Anexos',
        href: '/anexos',
        icon: FileDown,
        permission: 'documento.descargar',
      },
    ],
  },
  {
    id: 'grupos-interes',
    title: 'Grupos de interés',
    icon: UsersRound,
    items: [
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
    ],
  },
  {
    id: 'gestion-calidad',
    title: 'Gestión de calidad',
    icon: Workflow,
    items: [
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
        activeMatch: ['/cronograma'],
      },
      {
        title: 'Sesiones',
        href: '/sesiones',
        icon: CalendarClock,
        permission: 'sesion.ver',
      },
    ],
  },
] as const;

export const MAIN_NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
