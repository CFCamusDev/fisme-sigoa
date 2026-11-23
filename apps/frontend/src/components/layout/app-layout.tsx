import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useRestoreFocus } from '@/hooks/use-restore-focus';
import { Header } from './header';
import { Sidebar } from './sidebar';

export interface AppLayoutProps {
  children?: ReactNode;
  userMenu?: ReactNode;
}

export function AppLayout({ children, userMenu }: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMobileMenuOpenRef = useRef(false);
  const { remember, restore } = useRestoreFocus();

  const handleToggleMobileMenu = useCallback(
    (opener: HTMLElement) => {
      if (!isMobileMenuOpenRef.current) {
        remember(opener);
        isMobileMenuOpenRef.current = true;
        setIsMobileMenuOpen(true);
      } else {
        isMobileMenuOpenRef.current = false;
        setIsMobileMenuOpen(false);
      }
    },
    [remember],
  );

  const handleCloseMobileMenu = useCallback(() => {
    if (!isMobileMenuOpenRef.current) {
      return;
    }
    isMobileMenuOpenRef.current = false;
    setIsMobileMenuOpen(false);
    restore();
  }, [restore]);

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      {/* Enlace accesible para saltar directo al contenido */}
      <a
        href="#main-content"
        onClick={() => {
          document.getElementById('main-content')?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-label focus:font-semibold focus:text-primary-foreground focus-ring shadow-md"
      >
        Saltar al contenido principal
      </a>

      <Header
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={handleToggleMobileMenu}
        userMenu={userMenu}
      />

      <div className="flex flex-1 items-start">
        <Sidebar isOpen={isMobileMenuOpen} onClose={handleCloseMobileMenu} />

        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 min-h-[calc(100dvh-4rem)] p-4 lg:p-8 focus:outline-hidden"
        >
          <div className="mx-auto w-full max-w-[1280px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
