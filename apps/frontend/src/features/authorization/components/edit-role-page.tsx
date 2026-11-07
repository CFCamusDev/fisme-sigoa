import { Link, useNavigate } from '@tanstack/react-router';
import { PageHeader } from '@/components/common/page-header.js';
import { LoadingState } from '@/components/common/loading-state.js';
import { ErrorState } from '@/components/common/error-state.js';
import { buttonVariants } from '@/components/ui/button.js';
import { cn } from '@/lib/utils.js';
import { useRoles } from '../hooks/index.js';
import { RoleForm } from './role-form.js';

export interface EditRolePageProps {
  roleId: string;
}

export function EditRolePage({ roleId }: EditRolePageProps) {
  const navigate = useNavigate();
  const rolesQuery = useRoles();

  const handleSuccess = () => {
    navigate({ to: '/roles' });
  };

  const handleCancel = () => {
    navigate({ to: '/roles' });
  };

  if (rolesQuery.isLoading) {
    return (
      <div className="surface rounded-lg p-6">
        <LoadingState message="Cargando datos del rol..." />
      </div>
    );
  }

  if (rolesQuery.error) {
    return (
      <div className="surface rounded-lg p-6">
        <ErrorState
          title="Error al cargar el rol"
          message={rolesQuery.error.message || 'No se pudo cargar la información de los roles.'}
          onRetry={() => rolesQuery.refetch()}
        />
      </div>
    );
  }

  const role = rolesQuery.data?.items.find((r) => r.id === roleId);

  if (!role) {
    return (
      <div className="surface rounded-lg p-6 space-y-4">
        <ErrorState
          title="No se encontró el rol"
          message="El rol solicitado no existe o fue eliminado del sistema."
        />
        <div className="flex justify-center">
          <Link to="/roles" className={cn(buttonVariants({ variant: 'default' }))}>
            Volver a la lista
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Editar rol: ${role.name}`}
        description="Actualiza el nombre y descripción del rol. Los permisos asociados se gestionan en la matriz de permisos."
      />

      <section className="surface rounded-lg p-6">
        <RoleForm
          mode="edit"
          initialRole={role}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </section>
    </div>
  );
}
