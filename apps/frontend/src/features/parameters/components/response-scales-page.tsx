import { useEffect, useRef, useState } from 'react';
import type { ResponseScaleDto } from '@sigoa/shared';
import { PageHeader, LoadingState, ErrorState } from '@/components/common';
import { Can } from '@/components/common/can';
import { EmptyState } from '@/components/common/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/hooks/use-permission';
import { useResponseScales } from '../hooks/use-response-scales';
import { DuplicateScaleForm } from './duplicate-scale-form';
import { ResponseScaleCard } from './response-scale-card';
import { ResponseScaleForm } from './response-scale-form';

type Panel =
  | { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly scale: ResponseScaleDto }
  | { readonly kind: 'duplicate'; readonly scaleId: string }
  | null;

export function ResponseScalesPage() {
  const { allowed: canEdit, isLoading: permissionLoading } = usePermission(
    'parametro.editar',
    'GLOBAL',
  );
  const { data, isLoading, isError, error, refetch } = useResponseScales();

  const [panel, setPanel] = useState<Panel>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [restoreTick, setRestoreTick] = useState(0);

  // Al cerrar un panel el foco vuelve al botón que lo abrió.
  useEffect(() => {
    if (restoreTick > 0) {
      openerRef.current?.focus();
    }
  }, [restoreTick]);

  const open = (next: Exclude<Panel, null>, opener: HTMLElement) => {
    openerRef.current = opener;
    setSuccess(null);
    setPanel(next);
  };

  const close = () => {
    setPanel(null);
    setRestoreTick((tick) => tick + 1);
  };

  const saved = (message: string) => {
    setSuccess(message);
    close();
  };

  const newScaleButton = (
    <Can permission="parametro.editar" scope="GLOBAL">
      <Button type="button" onClick={(event) => open({ kind: 'create' }, event.currentTarget)}>
        Nueva escala
      </Button>
    </Can>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Escalas de respuesta"
        description="Niveles de respuesta que usan las encuestas y el cálculo de logro. Una escala en uso no se modifica: se duplica."
        actions={newScaleButton}
      />

      {!permissionLoading && !canEdit && (
        <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
          <p className="text-sm text-muted-foreground">
            Solo lectura: no tienes permiso para modificar las escalas.
          </p>
        </div>
      )}

      {success && (
        <Alert variant="success" role="status">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {canEdit && panel && (panel.kind === 'create' || panel.kind === 'edit') && (
        <ResponseScaleForm
          key={panel.kind === 'edit' ? panel.scale.id : 'create'}
          mode={panel}
          onCancel={close}
          onSaved={saved}
        />
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
          action={canEdit ? newScaleButton : undefined}
        />
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <div className="space-y-6">
          {data.items.map((scale) => (
            <ResponseScaleCard
              key={scale.id}
              scale={scale}
              canEdit={canEdit}
              onEdit={(target, opener) => open({ kind: 'edit', scale: target }, opener)}
              onDuplicate={(target, opener) =>
                open({ kind: 'duplicate', scaleId: target.id }, opener)
              }
              panel={
                canEdit && panel?.kind === 'duplicate' && panel.scaleId === scale.id ? (
                  <DuplicateScaleForm
                    scale={scale}
                    onCancel={close}
                    onDuplicated={(created) => saved(`Escala duplicada como ${created.code}.`)}
                  />
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
