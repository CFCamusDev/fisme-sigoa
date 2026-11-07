import { Link } from '@tanstack/react-router';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { StatusBadge } from '@/components/common/status-badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RoleDto } from '@sigoa/shared';

export interface RolesTableProps {
  roles: RoleDto[];
  isLoading?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
}

const countFormatter = new Intl.NumberFormat('es-PE');

export function RolesTable({ roles, isLoading = false, error = null, onRetry }: RolesTableProps) {
  const columns: DataTableColumn<RoleDto>[] = [
    {
      key: 'name',
      header: 'Nombre',
      render: (r) => (
        <div>
          <div className="font-medium text-foreground">{r.name}</div>
          <div className="text-body-sm text-muted-foreground">{r.code}</div>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Descripción',
      render: (r) => <span className="text-muted-foreground">{r.description ?? '—'}</span>,
    },
    {
      key: 'isPredefined',
      header: 'Tipo',
      render: (r) => (
        <span className="text-foreground">{r.isPredefined ? 'Predefinido' : 'Personalizado'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'userCount',
      header: 'Usuarios',
      headerClassName: 'text-right',
      className: 'text-right font-mono tabular-nums text-foreground',
      render: (r) => <span>{countFormatter.format(r.userCount)}</span>,
    },
    {
      key: 'permissions',
      header: 'Permisos',
      headerClassName: 'text-right',
      className: 'text-right font-mono tabular-nums text-foreground',
      render: (r) => <span>{countFormatter.format(r.permissions.length)}</span>,
    },
    {
      key: 'actions',
      header: 'Acciones',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (r) => (
        <Link
          to={'/roles/$roleId/editar' as string}
          params={{ roleId: r.id } as never}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          aria-label={`Editar rol ${r.name}`}
        >
          Editar
        </Link>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={roles}
      keyExtractor={(r) => r.id}
      caption="Catálogo de roles del sistema"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No hay roles registrados"
      emptyDescription="Aún no se han configurado roles en el sistema."
      emptyAction={
        <Link to={'/roles/nuevo' as string} className={cn(buttonVariants({ variant: 'default' }))}>
          Nuevo rol
        </Link>
      }
    />
  );
}
