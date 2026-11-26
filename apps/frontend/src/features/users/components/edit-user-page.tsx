import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/common/page-header';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { buttonVariants } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermission } from '@/hooks/use-permission';
import { useTabParam } from '@/hooks/use-tab-param';
import { cn } from '@/lib/utils';
import { readableApiMessage } from '@/lib/validation-errors';
import { UserAccessPanel } from '@/features/authorization';
import { useUser, usersKeys } from '../hooks';
import { UserForm } from './user-form';

const ALL_USER_TABS = ['datos', 'roles', 'permisos-directos', 'permisos-efectivos'] as const;
const DATA_ONLY_TABS = ['datos'] as const;

export interface EditUserPageProps {
  userId: string;
}

export function EditUserPage({ userId }: EditUserPageProps) {
  const queryClient = useQueryClient();
  const userQuery = useUser(userId);
  const { allowed: canAssignPermissions } = usePermission('permiso.asignar');
  const allowedTabs = useMemo(
    () => (canAssignPermissions ? ALL_USER_TABS : DATA_ONLY_TABS),
    [canAssignPermissions],
  );
  const [activeTab, setActiveTab] = useTabParam(allowedTabs, 'datos');

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
          message={readableApiMessage(
            userQuery.error,
            'No se pudo cargar la información del usuario.',
          )}
          onRetry={() => userQuery.refetch()}
        />
      </div>
    );
  }

  if (!userQuery.data) {
    return null;
  }

  const fullName = [userQuery.data.names, userQuery.data.firstSurname].filter(Boolean).join(' ');
  const handleUserAccessChanged = () => {
    void queryClient.invalidateQueries({ queryKey: usersKeys.all });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Editar usuario: ${fullName}`}
        description="Actualiza la información personal del usuario y gestiona sus roles y permisos."
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as (typeof allowedTabs)[number])}
      >
        <TabsList aria-label="Secciones de edición de usuario">
          <TabsTrigger value="datos">Datos</TabsTrigger>
          {canAssignPermissions ? (
            <>
              <TabsTrigger value="roles">Roles</TabsTrigger>
              <TabsTrigger value="permisos-directos">Permisos directos</TabsTrigger>
              <TabsTrigger value="permisos-efectivos">Permisos efectivos</TabsTrigger>
            </>
          ) : null}
        </TabsList>

        <TabsContent value="datos" forceMount className="data-[state=inactive]:hidden">
          <section className="surface rounded-lg p-6">
            <UserForm mode="edit" initialUser={userQuery.data} />
          </section>
        </TabsContent>

        {canAssignPermissions ? (
          <>
            <TabsContent value="roles" forceMount className="data-[state=inactive]:hidden">
              <section className="surface rounded-lg p-6">
                <UserAccessPanel
                  userId={userId}
                  section="roles"
                  onUserAccessChanged={handleUserAccessChanged}
                />
              </section>
            </TabsContent>

            <TabsContent
              value="permisos-directos"
              forceMount
              className="data-[state=inactive]:hidden"
            >
              <section className="surface rounded-lg p-6">
                <UserAccessPanel
                  userId={userId}
                  section="direct"
                  onUserAccessChanged={handleUserAccessChanged}
                />
              </section>
            </TabsContent>

            <TabsContent
              value="permisos-efectivos"
              forceMount
              className="data-[state=inactive]:hidden"
            >
              <section className="surface rounded-lg p-6">
                <UserAccessPanel
                  userId={userId}
                  section="effective"
                  onUserAccessChanged={handleUserAccessChanged}
                />
              </section>
            </TabsContent>
          </>
        ) : null}
      </Tabs>
    </div>
  );
}
