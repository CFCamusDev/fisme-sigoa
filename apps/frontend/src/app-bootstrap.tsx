import { useEffect, useState, type ReactNode } from 'react';
import { LoadingState } from '@/components/common/loading-state';
import { restoreSession } from '@/features/auth';

export interface AppBootstrapProps {
  children: ReactNode;
}

/**
 * Componente raíz de arranque que verifica y restaura la sesión antes de inicializar
 * el enrutador o evaluar guardas de rutas.
 */
export function AppBootstrap({ children }: AppBootstrapProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    void restoreSession().finally(() => {
      if (mounted) {
        setIsReady(true);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingState message="Iniciando sesión..." />
      </div>
    );
  }

  return <>{children}</>;
}
