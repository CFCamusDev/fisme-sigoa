import { Link } from '@tanstack/react-router';
import { PageHeader } from '@/components/common/page-header.js';
import { LoadingState } from '@/components/common/loading-state.js';
import { ErrorState } from '@/components/common/error-state.js';
import { EmptyState } from '@/components/common/empty-state.js';
import { StatusBadge } from '@/components/common/status-badge.js';
import { buttonVariants } from '@/components/ui/button.js';
import { cn } from '@/lib/utils.js';
import { usePermissions, useRoles } from '../hooks/index.js';
import { PermissionMatrixEditor } from './permission-matrix-editor.js';

export interface RolePermissionsPageProps {
  roleId: string;
}

export function RolePermissionsPage({ roleId }: RolePermissionsPageProps) {
  const rolesQuery = useRoles();
  const permissionsQuery = usePermissions();

  const isLoading = rolesQuery.isLoading || permissionsQuery.isLoading;
  const isError = rolesQuery.isError || permissionsQuery.isError;
  const error = rolesQuery.error ?? permissionsQuery.error;

  if (isLoading) {
    return (
      <div className="surface rounded-lg p-6">
        <LoadingState message="Cargando permisos del rol..." />
      </div>
    );
  }

  if (isError) {
    const isForbidden = error?.status === 403;
    if (isForbidden) {
      return (
        <div className="surface rounded-lg p-6 space-y-4">
          <ErrorState
            title="Acceso restringido"
            message="No tienes permiso para ver o modificar los permisos de este rol."
          />
          <div className="flex justify-center">
            <Link to="/roles" className={cn(buttonVariants({ variant: 'default' }))}>
              Volver a roles
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="surface rounded-lg p-6 space-y-4">
        <ErrorState
          title="Error al cargar datos"
          message={error?.message || 'No se pudo cargar la matriz de permisos.'}
          onRetry={() => {
            void rolesQuery.refetch();
            void permissionsQuery.refetch();
          }}
        />
        <div className="flex justify-center">
          <Link to="/roles" className={cn(buttonVariants({ variant: 'outline' }))}>
            Volver a roles
          </Link>
        </div>
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
            Volver a roles
          </Link>
        </div>
      </div>
    );
  }

  const catalog = permissionsQuery.data?.items ?? [];

  if (catalog.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Permisos del rol: ${role.name}`}
          description="Administra los permisos asignados a este rol."
          actions={
            <Link to="/roles" className={cn(buttonVariants({ variant: 'outline' }))}>
              Volver a roles
            </Link>
          }
        />
        <div className="surface rounded-lg p-6">
          <EmptyState
            title="No hay permisos en el catálogo"
            description="El catálogo de permisos no contiene elementos configurados."
          />
        </div>
      </div>
    );
  }

  const userNotice =
    role.userCount === 1
      ? 'Los cambios se aplican en la siguiente petición del usuario que tiene este rol.'
      : role.userCount > 1
        ? `Los cambios se aplican en la siguiente petición de los ${role.userCount} usuarios que tienen este rol.`
        : 'Este rol no tiene usuarios asignados actualmente.';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Permisos del rol: ${role.name}`}
        description={userNotice}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={role.status} />
            <Link to="/roles" className={cn(buttonVariants({ variant: 'outline' }))}>
              Volver a roles
            </Link>
          </div>
        }
      />

      <PermissionMatrixEditor role={role} catalog={catalog} />
    </div>
  );
}
