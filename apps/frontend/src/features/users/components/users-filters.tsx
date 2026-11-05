import { Select } from '@/components/ui/select';
import type { RoleSummary, UserStatus } from '@sigoa/shared';

export interface UsersFiltersProps {
  status?: UserStatus;
  roleId?: string;
  roles: RoleSummary[];
  rolesLoading?: boolean;
  onStatusChange: (status: UserStatus | undefined) => void;
  onRoleIdChange: (roleId: string | undefined) => void;
}

export function UsersFilters({
  status,
  roleId,
  roles,
  rolesLoading = false,
  onStatusChange,
  onRoleIdChange,
}: UsersFiltersProps) {
  return (
    <div className="surface flex flex-col gap-4 rounded-lg p-4 sm:flex-row sm:items-end">
      <div className="w-full sm:w-56">
        <label
          htmlFor="filter-status"
          className="mb-1 block text-label font-medium text-foreground"
        >
          Estado
        </label>
        <Select
          id="filter-status"
          value={status ?? ''}
          onChange={(e) => {
            const val = e.target.value as UserStatus | '';
            onStatusChange(val ? val : undefined);
          }}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos</option>
          <option value="ACTIVE">Activo</option>
          <option value="INACTIVE">Inactivo</option>
          <option value="PENDING_ACTIVATION">Pendiente de activación</option>
        </Select>
      </div>

      <div className="w-full sm:w-64">
        <label htmlFor="filter-role" className="mb-1 block text-label font-medium text-foreground">
          Rol
        </label>
        <Select
          id="filter-role"
          value={roleId ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            onRoleIdChange(val ? val : undefined);
          }}
          disabled={rolesLoading}
          aria-label="Filtrar por rol"
        >
          <option value="">Todos</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
