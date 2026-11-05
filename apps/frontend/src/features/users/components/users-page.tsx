import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { PageHeader } from '@/components/common/page-header';
import { ErrorState } from '@/components/common/error-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { UserStatus } from '@sigoa/shared';
import { useRoles, useUsers } from '../hooks';
import { UsersFilters } from './users-filters';
import { UsersPagination } from './users-pagination';
import { UsersTable } from './users-table';

export interface UsersSearchParams {
  status?: UserStatus;
  roleId?: string;
  page?: number;
  pageSize?: number;
}

export interface UsersPageProps {
  search?: UsersSearchParams;
  onSearchChange?: (newSearch: Partial<UsersSearchParams>) => void;
}

export function UsersPage({
  search: externalSearch,
  onSearchChange: externalOnSearchChange,
}: UsersPageProps = {}) {
  const [internalSearch, setInternalSearch] = useState<UsersSearchParams>({
    page: 1,
    pageSize: 20,
  });

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'danger';
    title?: string;
    message: string;
  } | null>(null);

  const search = externalSearch ?? internalSearch;
  const updateSearch =
    externalOnSearchChange ??
    ((updates: Partial<UsersSearchParams>) =>
      setInternalSearch((prev) => ({ ...prev, ...updates })));

  const page = search.page ?? 1;
  const pageSize = search.pageSize ?? 20;
  const status = search.status;
  const roleId = search.roleId;

  const usersQuery = useUsers({
    page,
    pageSize,
    status,
    roleId,
  });

  const rolesQuery = useRoles();
  const roles = rolesQuery.data?.items ?? [];

  const handleStatusChange = (newStatus: UserStatus | undefined) => {
    setFeedback(null);
    updateSearch({ status: newStatus, page: 1 });
  };

  const handleRoleIdChange = (newRoleId: string | undefined) => {
    setFeedback(null);
    updateSearch({ roleId: newRoleId, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    setFeedback(null);
    updateSearch({ page: newPage });
  };

  const isForbidden = usersQuery.error?.status === 403;
  const hasFiltersApplied = Boolean(status || roleId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Administra los usuarios del sistema, sus roles institucionales y sus estados de acceso."
        actions={
          <Link to="/usuarios/nuevo" className={cn(buttonVariants({ variant: 'default' }))}>
            Nuevo usuario
          </Link>
        }
      />

      <UsersFilters
        status={status}
        roleId={roleId}
        roles={roles}
        rolesLoading={rolesQuery.isLoading}
        onStatusChange={handleStatusChange}
        onRoleIdChange={handleRoleIdChange}
      />

      {feedback && (
        <Alert variant={feedback.type}>
          {feedback.title && <AlertTitle>{feedback.title}</AlertTitle>}
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      )}

      {isForbidden ? (
        <div className="surface rounded-lg p-6">
          <ErrorState
            title="Acceso restringido"
            message="No tienes permiso para ver los usuarios."
          />
        </div>
      ) : (
        <section aria-labelledby="users-table-heading" className="space-y-4">
          <h2 id="users-table-heading" className="sr-only">
            Listado de usuarios
          </h2>

          <UsersTable
            users={usersQuery.data?.items ?? []}
            roles={roles}
            isLoading={usersQuery.isLoading}
            error={usersQuery.error}
            hasFiltersApplied={hasFiltersApplied}
            onRetry={() => usersQuery.refetch()}
            onStatusChangeSuccess={(msg) => setFeedback({ type: 'success', message: msg })}
            onStatusChangeError={(msg) =>
              setFeedback({
                type: 'danger',
                title: 'Error al cambiar estado',
                message: msg,
              })
            }
          />

          {usersQuery.data && (
            <UsersPagination
              page={usersQuery.data.page}
              totalPages={usersQuery.data.totalPages}
              total={usersQuery.data.total}
              pageSize={usersQuery.data.pageSize}
              isLoading={usersQuery.isFetching}
              onPageChange={handlePageChange}
            />
          )}
        </section>
      )}
    </div>
  );
}
