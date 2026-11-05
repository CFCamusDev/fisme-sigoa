import { Link } from '@tanstack/react-router';
import { PageHeader } from '@/components/common/page-header';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUser } from '../hooks';
import { UserForm } from './user-form';

export interface EditUserPageProps {
  userId: string;
}

export function EditUserPage({ userId }: EditUserPageProps) {
  const userQuery = useUser(userId);

  if (userQuery.isLoading) {
    return (
      <div className="surface rounded-lg p-6">
        <LoadingState message="Cargando datos del usuario..." />
      </div>
    );
  }

  if (userQuery.error) {
    const isNotFound = userQuery.error.status === 404;
    const isForbidden = userQuery.error.status === 403;

    if (isNotFound) {
      return (
        <div className="surface rounded-lg p-6 space-y-4">
          <ErrorState
            title="No se encontró el usuario"
            message="El usuario solicitado no existe o fue eliminado del sistema."
          />
          <div className="flex justify-center">
            <Link to="/usuarios" className={cn(buttonVariants({ variant: 'default' }))}>
              Volver a la lista
            </Link>
          </div>
        </div>
      );
    }

    if (isForbidden) {
      return (
        <div className="surface rounded-lg p-6">
          <ErrorState
            title="Acceso restringido"
            message="No tienes permiso para ver o editar este usuario."
          />
        </div>
      );
    }

    return (
      <div className="surface rounded-lg p-6">
        <ErrorState
          title="Error al cargar el usuario"
          message={userQuery.error.message || 'No se pudo cargar la información del usuario.'}
          onRetry={() => userQuery.refetch()}
        />
      </div>
    );
  }

  if (!userQuery.data) {
    return null;
  }

  const fullName = [userQuery.data.names, userQuery.data.firstSurname].filter(Boolean).join(' ');

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Editar usuario: ${fullName}`}
        description="Actualiza la información personal del usuario. Los roles y el estado se gestionan de forma independiente."
      />

      <section className="surface rounded-lg p-6">
        <UserForm mode="edit" initialUser={userQuery.data} />
      </section>
    </div>
  );
}
