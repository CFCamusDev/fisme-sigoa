export interface HeaderProps {
  isMobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
}

export function Header({ isMobileMenuOpen, onToggleMobileMenu }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-4 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          aria-expanded={isMobileMenuOpen}
          aria-controls="app-sidebar"
          aria-label={isMobileMenuOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
          className="inline-flex items-center justify-center rounded-md p-2 text-neutral-700 hover:bg-neutral-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-900 lg:hidden"
        >
          <span className="sr-only">
            {isMobileMenuOpen ? 'Cerrar menú principal' : 'Abrir menú principal'}
          </span>
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            {isMobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            )}
          </svg>
        </button>

        <div className="flex flex-col">
          <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
            Facultad de Ingeniería de Sistemas y Mecánica Eléctrica
          </span>
          <span className="text-sm font-semibold text-neutral-900">
            Sistema Integrado de Gestión OE / AG
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
          UNTRM
        </span>
      </div>
    </header>
  );
}
