import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { ErrorPage } from './error-page';

export function NotFoundPage() {
  return (
    <ErrorPage
      illustration="notFound"
      title="Página no encontrada"
      description="La ruta solicitada no existe o ha sido movida."
      role="region"
      action={
        <Button asChild>
          <Link to="/">Volver al inicio</Link>
        </Button>
      }
    />
  );
}
