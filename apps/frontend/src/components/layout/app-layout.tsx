import { useState, type ReactNode } from 'react';
import { Header } from './header';
import { Sidebar } from './sidebar';

export interface AppLayoutProps {
  children?: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Enlace accesible para saltar directo al contenido */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-sky-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        Saltar al contenido principal
      </a>

      <div className="flex min-h-screen">
        <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

        <div className="flex min-h-screen flex-1 flex-col">
          <Header
            isMobileMenuOpen={isMobileMenuOpen}
            onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
          />

          <main id="main-content" tabIndex={-1} className="flex-1 p-4 lg:p-8 focus:outline-hidden">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
