import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { ErrorPage } from './error-page';

export interface UnexpectedErrorPageProps {
  onRetry?: () => void;
}

export function UnexpectedErrorPage({ onRetry }: UnexpectedErrorPageProps) {
  return (
    <ErrorPage
      illustration="error"
      title="Algo salió mal"
      description="No pudimos completar la acción. Inténtalo de nuevo; si persiste, avisa al administrador."
      role="alert"
      action={
        <>
          {onRetry && (
            <Button onClick={onRetry} variant="default">
              Reintentar
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to="/">Volver al inicio</Link>
          </Button>
        </>
      }
    />
  );
}
