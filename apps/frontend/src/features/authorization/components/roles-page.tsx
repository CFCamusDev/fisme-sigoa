import { Link } from '@tanstack/react-router';
import { PageHeader } from '@/components/common/page-header';
import { ErrorState } from '@/components/common/error-state';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRoles } from '../hooks';
import { RolesTable } from './roles-table';

export function RolesPage() {
  const rolesQuery = useRoles();

  const isForbidden = rolesQuery.error?.status === 403;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles"
        description="Administra los grupos de permisos de FISME-SIGOA"
        actions={
          <Link
            to={'/roles/nuevo' as string}
            className={cn(buttonVariants({ variant: 'default' }))}
          >
            Nuevo rol
          </Link>
        }
      />

      {isForbidden ? (
        <div className="surface rounded-lg p-6">
          <ErrorState title="Acceso restringido" message="No tienes permiso para ver los roles." />
        </div>
      ) : (
        <section aria-labelledby="roles-table-heading" className="space-y-4">
          <h2 id="roles-table-heading" className="sr-only">
            Listado de roles
          </h2>

          <RolesTable
            roles={rolesQuery.data?.items ?? []}
            isLoading={rolesQuery.isLoading}
            error={rolesQuery.error}
            onRetry={() => rolesQuery.refetch()}
          />
        </section>
      )}
    </div>
  );
}
