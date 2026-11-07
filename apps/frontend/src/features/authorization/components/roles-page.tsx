import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { PageHeader } from '@/components/common/page-header.js';
import { ErrorState } from '@/components/common/error-state.js';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.js';
import { Button, buttonVariants } from '@/components/ui/button.js';
import { cn } from '@/lib/utils.js';
import { useRoles } from '../hooks/index.js';
import { RolesTable } from './roles-table.js';

export function RolesPage() {
  const rolesQuery = useRoles();
  const [feedback, setFeedback] = React.useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const isForbidden = rolesQuery.error?.status === 403;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles"
        description="Administra los grupos de permisos de FISME-SIGOA"
        actions={
          <Link to="/roles/nuevo" className={cn(buttonVariants({ variant: 'default' }))}>
            Nuevo rol
          </Link>
        }
      />

      {feedback && (
        <Alert
          variant={feedback.type === 'success' ? 'success' : 'danger'}
          role={feedback.type === 'success' ? 'status' : 'alert'}
          className="flex items-center justify-between"
        >
          <div>
            <AlertTitle>{feedback.type === 'success' ? 'Éxito' : 'Error'}</AlertTitle>
            <AlertDescription>{feedback.message}</AlertDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFeedback(null)}
            aria-label="Cerrar notificación"
          >
            ×
          </Button>
        </Alert>
      )}

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
            onStatusChangeError={(message) => setFeedback({ type: 'error', message })}
            onStatusChangeSuccess={(message) => setFeedback({ type: 'success', message })}
          />
        </section>
      )}
    </div>
  );
}
