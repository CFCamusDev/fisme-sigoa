import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { StatusBadge } from '@/components/common/status-badge';
import { buttonVariants } from '@/components/ui/button';
import { formatDateTime } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { RoleSummary, UserDto } from '@sigoa/shared';

export interface UsersTableProps {
  users: UserDto[];
  roles: RoleSummary[];
  isLoading?: boolean;
  error?: Error | string | null;
  hasFiltersApplied?: boolean;
  onRetry?: () => void;
  renderRowActions?: (user: UserDto) => ReactNode;
}

export function UsersTable({
  users,
  roles,
  isLoading = false,
  error = null,
  hasFiltersApplied = false,
  onRetry,
  renderRowActions,
}: UsersTableProps) {
  const rolesMap = new Map<string, string>();
  for (const role of roles) {
    rolesMap.set(role.id, role.name);
  }

  const columns: DataTableColumn<UserDto>[] = [
    {
      key: 'fullName',
      header: 'Nombre completo',
      render: (u) => {
        const full = [u.names, u.firstSurname, u.secondSurname].filter(Boolean).join(' ');
        return <span className="font-medium text-foreground">{full}</span>;
      },
    },
    {
      key: 'email',
      header: 'Correo',
      render: (u) => <span className="text-foreground">{u.email}</span>,
    },
    {
      key: 'dni',
      header: 'DNI',
      render: (u) => <span>{u.dni ?? '—'}</span>,
    },
    {
      key: 'roles',
      header: 'Roles',
      render: (u) => {
        if (!u.roleIds || u.roleIds.length === 0) {
          return <span>—</span>;
        }
        const roleNames = u.roleIds.map((id) => rolesMap.get(id)).filter(Boolean);
        return <span>{roleNames.length > 0 ? roleNames.join(', ') : '—'}</span>;
      },
    },
    {
      key: 'status',
      header: 'Estado',
      render: (u) => <StatusBadge status={u.status} />,
    },
    {
      key: 'lastLoginAt',
      header: 'Último acceso',
      render: (u) => <span>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Nunca'}</span>,
    },
    {
      key: 'actions',
      header: 'Acciones',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (u) => {
        const fullName = [u.names, u.firstSurname].filter(Boolean).join(' ');
        if (renderRowActions) {
          return renderRowActions(u);
        }
        return (
          <div className="flex items-center justify-end gap-2">
            <Link
              to={'/usuarios/$userId/editar' as never}
              params={{ userId: u.id } as never}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              aria-label={`Editar a ${fullName}`}
            >
              Editar
            </Link>
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={users}
      keyExtractor={(u) => u.id}
      caption="Lista de usuarios registrados en el sistema"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle={
        hasFiltersApplied ? 'No hay usuarios que coincidan con los filtros' : 'Aún no hay usuarios'
      }
      emptyDescription={
        hasFiltersApplied
          ? 'Intenta ajustar o limpiar los filtros seleccionados para ver más resultados.'
          : 'Puedes registrar un nuevo usuario en la plataforma utilizando el botón superior.'
      }
    />
  );
}
