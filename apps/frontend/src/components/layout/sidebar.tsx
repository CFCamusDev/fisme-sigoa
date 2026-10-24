import { useEffect } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { MAIN_NAV_ITEMS, type NavItem } from './nav-items';

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  items?: readonly NavItem[];
}

export function Sidebar({ isOpen, onClose, items = MAIN_NAV_ITEMS }: SidebarProps) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop para pantallas pequeñas */}
      {isOpen && (
        <div
          role="presentation"
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-neutral-900/50 backdrop-blur-xs transition-opacity lg:hidden"
        />
      )}

      {/* Barra lateral */}
      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-neutral-200 bg-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Barra lateral de navegación"
      >
        <div className="flex h-16 items-center justify-between border-b border-neutral-200 px-6">
          <Link
            to="/"
            className="flex items-center gap-2 font-bold text-neutral-900"
            onClick={onClose}
          >
            <span className="rounded bg-sky-900 px-2 py-1 text-xs font-semibold text-white">
              EPIS
            </span>
            <span className="text-sm font-semibold tracking-tight">FISME-SIGOA</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar barra lateral"
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 lg:hidden"
          >
            <span className="sr-only">Cerrar barra lateral</span>
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4" aria-label="Navegación principal">
          <ul className="space-y-1">
            {items.map((item) => {
              const isActive = currentPath === item.href;
              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    onClick={onClose}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-neutral-100 font-semibold text-sky-950'
                        : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900'
                    }`}
                  >
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-neutral-200 p-4 text-xs text-neutral-500">
          <p className="font-medium text-neutral-700">UNTRM · EPIS</p>
          <p className="mt-0.5 text-[11px] text-neutral-400">Versión 0.1.0</p>
        </div>
      </aside>
    </>
  );
}
