import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { RoleGrant } from '@sigoa/shared';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { LoadingState } from '@/components/common/loading-state.js';
import { ErrorState } from '@/components/common/error-state.js';
import { useAuth } from '@/hooks/use-auth.js';
import { cn } from '@/lib/utils.js';
import { useUserAccess } from '../hooks/use-user-access.js';
import { useRoles } from '../hooks/use-roles.js';
import { usePermissions } from '../hooks/use-permissions.js';
import { useAssignUserRoles } from '../hooks/use-assign-user-roles.js';
import { useAssignUserPermissions } from '../hooks/use-assign-user-permissions.js';
import { getUserAccessErrorMessage } from '../lib/user-access-error-message.js';
import { UserRolesEditor } from './user-roles-editor.js';
import { UserDirectPermissionsEditor } from './user-direct-permissions-editor.js';
import { EffectivePermissionsView } from './effective-permissions-view.js';

export interface UserAccessPanelProps {
  readonly userId: string;
  readonly onUserAccessChanged?: () => void;
  readonly className?: string;
}

export function UserAccessPanel({ userId, onUserAccessChanged, className }: UserAccessPanelProps) {
  const { user: currentUser } = useAuth();
  const isSelfEdit = currentUser?.id === userId;

  const userAccessQuery = useUserAccess(userId);
  const rolesQuery = useRoles();
  const permissionsQuery = usePermissions();
  const assignRolesMutation = useAssignUserRoles(userId);
  const assignPermissionsMutation = useAssignUserPermissions(userId);

  const [rolesSuccessMessage, setRolesSuccessMessage] = React.useState<string | null>(null);
  const [rolesErrorMessage, setRolesErrorMessage] = React.useState<string | null>(null);
  const [permissionsSuccessMessage, setPermissionsSuccessMessage] = React.useState<string | null>(
    null,
  );
  const [permissionsErrorMessage, setPermissionsErrorMessage] = React.useState<string | null>(null);

  const isSubmittingRef = React.useRef(false);
  const isBusy = assignRolesMutation.isPending || assignPermissionsMutation.isPending;

  const handleSaveRoles = async (roleIds: string[]) => {
    if (isBusy || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setRolesSuccessMessage(null);
    setRolesErrorMessage(null);
    try {
      await assignRolesMutation.mutateAsync({ roleIds });
      setRolesSuccessMessage('Roles actualizados correctamente.');
      onUserAccessChanged?.();
    } catch (error) {
      setRolesErrorMessage(getUserAccessErrorMessage(error));
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleDiscardRoles = () => {
    setRolesSuccessMessage(null);
    setRolesErrorMessage(null);
  };

  const handleSavePermissions = async (permissions: RoleGrant[]) => {
    if (isBusy || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setPermissionsSuccessMessage(null);
    setPermissionsErrorMessage(null);
    try {
      await assignPermissionsMutation.mutateAsync({ permissions });
      setPermissionsSuccessMessage('Permisos directos actualizados correctamente.');
      onUserAccessChanged?.();
    } catch (error) {
      setPermissionsErrorMessage(getUserAccessErrorMessage(error));
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleDiscardPermissions = () => {
    setPermissionsSuccessMessage(null);
    setPermissionsErrorMessage(null);
  };

  if (userAccessQuery.isLoading) {
    return (
      <div className={cn('rounded-lg border border-border bg-card p-6', className)}>
        <LoadingState message="Cargando accesos del usuario..." />
      </div>
    );
  }

  if (userAccessQuery.error) {
    const isNotFound = userAccessQuery.error.status === 404;
    const isForbidden = userAccessQuery.error.status === 403;

    if (isNotFound) {
      return (
        <div className={cn('rounded-lg border border-border bg-card p-6', className)}>
          <ErrorState
            title="Usuario no encontrado"
            message="El usuario solicitado no existe o fue eliminado del sistema."
          />
        </div>
      );
    }

    if (isForbidden) {
      return (
        <div className={cn('rounded-lg border border-border bg-card p-6', className)}>
          <ErrorState
            title="Acceso restringido"
            message="No tienes permiso para ver los accesos de este usuario."
          />
        </div>
      );
    }

    return (
      <div className={cn('rounded-lg border border-border bg-card p-6', className)}>
        <ErrorState
          title="Error al cargar accesos"
          message={getUserAccessErrorMessage(userAccessQuery.error)}
          onRetry={() => userAccessQuery.refetch()}
        />
      </div>
    );
  }

  if (!userAccessQuery.data) {
    return null;
  }

  const userAccess = userAccessQuery.data;

  return (
    <div className={cn('space-y-8', className)}>
      {isSelfEdit && (
        <Alert variant="warning" className="border-warning-border bg-warning-soft">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertDescription className="text-xs">
            Estás editando tus propios accesos; si los reduces podrías perder el acceso a esta
            pantalla.
          </AlertDescription>
        </Alert>
      )}

      {/* Sección 1: Roles asignados */}
      <section aria-labelledby="user-roles-heading" className="space-y-4">
        <div>
          <h3 id="user-roles-heading" className="text-lg font-semibold text-foreground">
            Roles asignados
          </h3>
          <p className="text-xs text-muted-foreground">
            Selecciona los roles que corresponden a este usuario en el sistema.
          </p>
        </div>

        {rolesSuccessMessage && (
          <Alert variant="success">
            <AlertDescription className="text-xs">{rolesSuccessMessage}</AlertDescription>
          </Alert>
        )}

        {rolesErrorMessage && (
          <Alert variant="danger">
            <AlertDescription className="text-xs">{rolesErrorMessage}</AlertDescription>
          </Alert>
        )}

        {rolesQuery.isLoading && <LoadingState message="Cargando roles..." />}

        {rolesQuery.error && (
          <ErrorState
            title="Error al cargar roles"
            message={
              rolesQuery.error.status === 403
                ? 'No tienes permiso para ver los roles disponibles.'
                : rolesQuery.error.message || 'No se pudieron cargar los roles.'
            }
            onRetry={() => rolesQuery.refetch()}
          />
        )}

        {rolesQuery.data && (
          <UserRolesEditor
            assignedRoles={userAccess.roles}
            catalogRoles={rolesQuery.data.items}
            isSaving={isBusy}
            onSave={handleSaveRoles}
            onDiscard={handleDiscardRoles}
          />
        )}
      </section>

      {/* Sección 2: Permisos directos */}
      <section aria-labelledby="user-direct-permissions-heading" className="space-y-4">
        <div>
          <h3
            id="user-direct-permissions-heading"
            className="text-lg font-semibold text-foreground"
          >
            Permisos directos
          </h3>
          <p className="text-xs text-muted-foreground">
            Asigna permisos individuales adicionales que complementen los roles asignados.
          </p>
        </div>

        {permissionsSuccessMessage && (
          <Alert variant="success">
            <AlertDescription className="text-xs">{permissionsSuccessMessage}</AlertDescription>
          </Alert>
        )}

        {permissionsErrorMessage && (
          <Alert variant="danger">
            <AlertDescription className="text-xs">{permissionsErrorMessage}</AlertDescription>
          </Alert>
        )}

        {permissionsQuery.isLoading && <LoadingState message="Cargando catálogo de permisos..." />}

        {permissionsQuery.error && (
          <ErrorState
            title="Error al cargar catálogo de permisos"
            message={
              permissionsQuery.error.status === 403
                ? 'No tienes permiso para ver los permisos disponibles.'
                : permissionsQuery.error.message || 'No se pudo cargar el catálogo de permisos.'
            }
            onRetry={() => permissionsQuery.refetch()}
          />
        )}

        {permissionsQuery.data && (
          <UserDirectPermissionsEditor
            directPermissions={userAccess.directPermissions}
            catalog={permissionsQuery.data.items}
            isSaving={isBusy}
            onSave={handleSavePermissions}
            onDiscard={handleDiscardPermissions}
          />
        )}
      </section>

      {/* Sección 3: Permisos efectivos */}
      <section aria-labelledby="user-effective-permissions-heading" className="space-y-4">
        <div>
          <h3
            id="user-effective-permissions-heading"
            className="text-lg font-semibold text-foreground"
          >
            Permisos efectivos
          </h3>
          <p className="text-xs text-muted-foreground">
            Vista consolidada de todos los permisos que posee el usuario y su origen.
          </p>
        </div>

        <EffectivePermissionsView
          entries={userAccess.effectivePermissions}
          catalog={permissionsQuery.data}
          headingLevel="h4"
        />
      </section>
    </div>
  );
}
