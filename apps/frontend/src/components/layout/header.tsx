import type { ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/common/logo';

export interface HeaderProps {
  isMobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  userMenu?: ReactNode;
}

export function Header({ isMobileMenuOpen, onToggleMobileMenu, userMenu }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between bg-topbar text-topbar-foreground shadow-sm px-4 lg:px-8">
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          aria-expanded={isMobileMenuOpen}
          aria-controls="app-sidebar"
          aria-label={isMobileMenuOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
          className="inline-flex items-center justify-center rounded-md p-2 text-topbar-foreground hover:bg-brand-800/80 focus-ring lg:hidden"
        >
          <span className="sr-only">
            {isMobileMenuOpen ? 'Cerrar menú principal' : 'Abrir menú principal'}
          </span>
          {isMobileMenuOpen ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" aria-hidden="true" />
          )}
        </button>

        <div className="flex items-center gap-3">
          <Logo variant="horizontal" size={40} className="shrink-0" />
          <span className="hidden sm:inline-block border-l border-brand-500/40 pl-3 text-meta text-brand-200">
            Facultad de Ingeniería de Sistemas y Mecánica Eléctrica
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {userMenu ?? (
          <span className="rounded-full bg-brand-800/60 px-3 py-1 text-meta font-medium text-brand-100">
            UNTRM · EPIS
          </span>
        )}
      </div>
    </header>
  );
}
