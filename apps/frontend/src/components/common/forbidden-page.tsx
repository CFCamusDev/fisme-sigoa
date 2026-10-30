import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { ErrorPage } from './error-page';

export function ForbiddenPage() {
  return (
    <ErrorPage
      illustration="noPermission"
      title="No tienes acceso a esta sección"
      description="No cuentas con los permisos necesarios para acceder a este recurso. Si crees que se trata de un error, contacta al administrador del sistema."
      role="region"
      action={
        <Button asChild>
          <Link to="/">Volver al panel</Link>
        </Button>
      }
    />
  );
}
