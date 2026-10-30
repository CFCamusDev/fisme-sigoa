import { useState, type ReactNode } from 'react';
import { Header } from './header';
import { Sidebar } from './sidebar';

export interface AppLayoutProps {
  children?: ReactNode;
  userMenu?: ReactNode;
}

export function AppLayout({ children, userMenu }: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Enlace accesible para saltar directo al contenido */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-label focus:font-semibold focus:text-primary-foreground focus-ring shadow-md"
      >
        Saltar al contenido principal
      </a>

      <Header
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        userMenu={userMenu}
      />

      <div className="flex flex-1">
        <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 p-4 lg:p-8 max-w-[1280px] focus:outline-hidden"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
