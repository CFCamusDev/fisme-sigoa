import { PageHeader, LoadingState, ErrorState } from '@/components/common';
import { EmptyState } from '@/components/common/empty-state';
import { usePermission } from '@/hooks/use-permission';
import { useResponseScales } from '../hooks/use-response-scales';
import { ResponseScaleCard } from './response-scale-card';

export function ResponseScalesPage() {
  const { allowed: canEdit, isLoading: permissionLoading } = usePermission(
    'parametro.editar',
    'GLOBAL',
  );
  const { data, isLoading, isError, error, refetch } = useResponseScales();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Escalas de respuesta"
        description="Niveles de respuesta que usan las encuestas y el cálculo de logro. Una escala en uso no se modifica: se duplica."
      />

      {!permissionLoading && !canEdit && (
        <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
          <p className="text-sm text-muted-foreground">
            Solo lectura: no tienes permiso para modificar las escalas.
          </p>
        </div>
      )}

      {isLoading && <LoadingState message="Cargando escalas..." />}

      {isError &&
        (error?.status === 403 ? (
          <ErrorState
            title="Acceso denegado"
            message="No tienes permiso para consultar las escalas."
            illustration="noPermission"
          />
        ) : (
          <ErrorState
            title="Error al cargar las escalas"
            message="No se pudieron obtener las escalas. Intenta de nuevo."
            onRetry={() => void refetch()}
          />
        ))}

      {!isLoading && !isError && data && data.items.length === 0 && (
        <EmptyState
          title="No hay escalas configuradas"
          description="Las escalas de origen se cargan con la configuración inicial del sistema."
          illustration="empty"
        />
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <div className="space-y-6">
          {data.items.map((scale) => (
            <ResponseScaleCard key={scale.id} scale={scale} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  );
}
