import { useEffect } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { MAIN_NAV_ITEMS, type NavItem } from './nav-items';

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  items?: readonly NavItem[];
}

interface SidebarNavItemProps {
  item: NavItem;
  isActive: boolean;
  onClose: () => void;
}

function SidebarNavItem({ item, isActive, onClose }: SidebarNavItemProps) {
  const { allowed, isLoading } = usePermission(item.permission ?? '');
  const Icon = item.icon;

  if (item.permission) {
    if (isLoading) {
      return (
        <li aria-hidden="true" data-testid={`sidebar-skeleton-${item.href}`}>
          <div className="flex items-center gap-3 rounded-md px-3 py-2">
            <div className="size-5 shrink-0 animate-pulse rounded bg-muted" />
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          </div>
        </li>
      );
    }

    if (!allowed) {
      return null;
    }
  }

  return (
    <li>
      <Link
        to={item.href}
        onClick={onClose}
        aria-current={isActive ? 'page' : undefined}
        className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-label font-medium transition-colors ${
          isActive
            ? 'bg-sidebar-active text-sidebar-active-foreground font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r before:bg-brand-700'
            : 'text-sidebar-foreground hover:bg-brand-50'
        }`}
      >
        {Icon && <Icon className="size-5 shrink-0" aria-hidden="true" />}
        <span>{item.title}</span>
      </Link>
    </li>
  );
}

export function Sidebar({ isOpen, onClose, items = MAIN_NAV_ITEMS }: SidebarProps) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        const toggleButton = document.querySelector<HTMLButtonElement>(
          'button[aria-controls="app-sidebar"]',
        );
        toggleButton?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop para pantallas menores a 1024px */}
      {isOpen && (
        <div
          role="presentation"
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 top-16 z-40 bg-brand-950/60 transition-opacity lg:hidden"
        />
      )}

      {/* Barra lateral */}
      <aside
        id="app-sidebar"
        className={`fixed top-16 bottom-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-sidebar transition-transform duration-200 ease-standard lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Barra lateral de navegación"
      >
        {isOpen && (
          <div className="flex items-center justify-between p-4 lg:hidden border-b border-border">
            <span className="text-meta font-bold uppercase tracking-wider text-muted-foreground">
              Navegación
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar barra lateral"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-brand-50"
            >
              <span className="sr-only">Cerrar barra lateral</span>
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-4" aria-label="Navegación principal">
          <ul className="space-y-1">
            {items.map((item) => (
              <SidebarNavItem
                key={item.href}
                item={item}
                isActive={currentPath === item.href}
                onClose={onClose}
              />
            ))}
          </ul>
        </nav>

        <div className="border-t border-border p-4 text-meta text-muted-foreground">
          <p className="font-semibold text-foreground">UNTRM · EPIS</p>
          <p className="mt-0.5 text-meta text-muted-foreground">Versión 0.1.0</p>
        </div>
      </aside>
    </>
  );
}
