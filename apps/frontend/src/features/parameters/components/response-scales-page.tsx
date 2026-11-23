import { useRef, useState } from 'react';
import type { ResponseScaleDto } from '@sigoa/shared';
import { PageHeader, LoadingState, ErrorState } from '@/components/common';
import { Can } from '@/components/common/can';
import { EmptyState } from '@/components/common/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePermission } from '@/hooks/use-permission';
import { useRestoreFocus } from '@/hooks/use-restore-focus';
import { useResponseScales } from '../hooks/use-response-scales';
import { DuplicateScaleForm } from './duplicate-scale-form';
import { ResponseScaleCard } from './response-scale-card';
import { ResponseScaleForm } from './response-scale-form';

type Panel =
  | { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly scale: ResponseScaleDto }
  | { readonly kind: 'duplicate'; readonly scale: ResponseScaleDto }
  | null;

export function ResponseScalesPage() {
  const { allowed: canEdit, isLoading: permissionLoading } = usePermission(
    'parametro.editar',
    'GLOBAL',
  );
  const { data, isLoading, isError, error, refetch } = useResponseScales();

  const [panel, setPanel] = useState<Panel>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);
  const { remember, restore } = useRestoreFocus();

  const open = (next: Exclude<Panel, null>, opener: HTMLElement) => {
    remember(opener);
    setSuccess(null);
    setPanel(next);
  };

  const close = () => {
    setPanel(null);
    restore();
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

  const dialogTitle =
    panel?.kind === 'create'
      ? 'Nueva escala'
      : panel?.kind === 'edit'
        ? 'Editar escala'
        : panel?.kind === 'duplicate'
          ? 'Duplicar escala'
          : '';

  const dialogDescription =
    panel?.kind === 'create'
      ? 'Define el código, el nombre, el tipo y los niveles de la escala.'
      : panel?.kind === 'edit'
        ? 'Cambia el nombre o los niveles. El código y el tipo no se pueden modificar.'
        : panel?.kind === 'duplicate'
          ? `Se copian el tipo y los niveles de «${panel.scale.name}» en una escala nueva que sí puedes editar.`
          : '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Escalas de respuesta"
        description="Niveles de respuesta que usan las encuestas y el cálculo de logro. Una escala en uso no se modifica: se duplica."
        actions={newScaleButton}
      />

      <p className="text-sm text-muted-foreground">
        Solo Evidencia 4 cuenta como logro por defecto; en una copia de la escala se pueden marcar
        otros niveles.
      </p>

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
        <div className="space-y-4">
          {data.items.map((scale) => (
            <ResponseScaleCard
              key={scale.id}
              scale={scale}
              canEdit={canEdit}
              onEdit={(target, opener) => open({ kind: 'edit', scale: target }, opener)}
              onDuplicate={(target, opener) => open({ kind: 'duplicate', scale: target }, opener)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={canEdit && panel !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            close();
          }
        }}
      >
        <DialogContent
          size="md"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            dialogTitleRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle ref={dialogTitleRef} tabIndex={-1} className="focus:outline-none">
              {dialogTitle}
            </DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>

          {panel && (panel.kind === 'create' || panel.kind === 'edit') && (
            <ResponseScaleForm
              key={panel.kind === 'edit' ? panel.scale.id : 'create'}
              mode={panel}
              inDialog
              onCancel={close}
              onSaved={saved}
            />
          )}

          {panel?.kind === 'duplicate' && (
            <DuplicateScaleForm
              key={panel.scale.id}
              scale={panel.scale}
              inDialog
              onCancel={close}
              onDuplicated={(created) => saved(`Escala duplicada como ${created.code}.`)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
