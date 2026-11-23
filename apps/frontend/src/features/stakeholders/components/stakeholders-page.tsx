import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';
import {
  STAKEHOLDER_VOID_REASON_MAX_LENGTH,
  STAKEHOLDER_VOID_REASON_MIN_LENGTH,
  type StakeholderDto,
} from '@sigoa/shared';
import { Can } from '@/components/common/can';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { FormDialog } from '@/components/common/form-dialog';
import { LoadingState } from '@/components/common/loading-state';
import { PageHeader } from '@/components/common/page-header';
import { useRestoreFocus } from '@/components/common/use-restore-focus';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useStakeholders } from '../hooks/use-stakeholders';
import { useVoidStakeholder } from '../hooks/use-void-stakeholder';
import { getStakeholderErrorMessage } from '../lib/stakeholder-error-message';
import { getStakeholderDocumentLabel } from '../lib/stakeholder-labels';
import { StakeholderForm } from './stakeholder-form';
import { StakeholdersFilters, type StakeholdersFiltersState } from './stakeholders-filters';
import { StakeholdersPagination } from './stakeholders-pagination';
import { StakeholdersTable } from './stakeholders-table';

const PAGE_SIZE = 20;

type ActivePanel =
  | { readonly type: 'none' }
  | { readonly type: 'register' }
  | { readonly type: 'edit'; readonly stakeholder: StakeholderDto }
  | { readonly type: 'void'; readonly stakeholder: StakeholderDto };

export interface StakeholdersPageProps {
  readonly initialEditId?: string;
}

export function StakeholdersPage({ initialEditId }: StakeholdersPageProps = {}) {
  const [filters, setFilters] = useState<StakeholdersFiltersState>({
    search: '',
    kind: '',
    status: '',
  });
  const [page, setPage] = useState(1);
  const [manualPanel, setManualPanel] = useState<ActivePanel | null>(null);
  const [dismissedEditId, setDismissedEditId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successAlertRef = useRef<HTMLDivElement>(null);
  const submittedJustNowRef = useRef(false);
  const { capture: captureFocus, restore: restoreFocus } = useRestoreFocus();
  const voidMutation = useVoidStakeholder();

  const query = useStakeholders({
    search: filters.search || undefined,
    kind: filters.kind || undefined,
    status: filters.status || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  useEffect(() => {
    if (successMessage) {
      successAlertRef.current?.focus();
    }
  }, [successMessage]);

  function setPanel(next: ActivePanel) {
    setManualPanel(next);
    if (initialEditId) {
      setDismissedEditId(initialEditId);
    }
  }

  function handleApplyFilters(next: StakeholdersFiltersState) {
    setFilters(next);
    setPage(1);
  }

  function handleSaved(stakeholder: StakeholderDto, mode: 'register' | 'edit') {
    submittedJustNowRef.current = true;
    setPanel({ type: 'none' });
    setSuccessMessage(
      mode === 'register'
        ? `Constituyente "${stakeholder.fullName}" registrado correctamente.`
        : `Constituyente "${stakeholder.fullName}" actualizado correctamente.`,
    );
  }

  function handleVoided(stakeholder: StakeholderDto) {
    setPanel({ type: 'none' });
    setSuccessMessage(`Constituyente "${stakeholder.fullName}" anulado correctamente.`);
  }

  const hasFilters = Boolean(filters.search || filters.kind || filters.status);
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = query.data?.totalPages ?? 0;

  const initialEditTarget =
    initialEditId &&
    dismissedEditId !== initialEditId &&
    manualPanel === null &&
    !query.isLoading &&
    !query.isError
      ? (items.find((item) => item.id === initialEditId) ?? null)
      : undefined;

  const initialEditMissing =
    initialEditTarget === null ||
    (initialEditTarget !== undefined && initialEditTarget.status === 'VOIDED');

  const panel: ActivePanel =
    manualPanel ??
    (initialEditTarget && initialEditTarget.status !== 'VOIDED'
      ? { type: 'edit', stakeholder: initialEditTarget }
      : { type: 'none' });

  return (
    <section className="space-y-6 bg-background text-foreground">
      <PageHeader
        title="Constituyentes"
        description="Registro maestro único de personas e instituciones vinculadas al programa."
        actions={
          <Can permission="constituyente.editar">
            <Button
              type="button"
              onClick={() => {
                captureFocus();
                setSuccessMessage(null);
                setPanel({ type: 'register' });
              }}
            >
              <Plus className="mr-2 size-4" aria-hidden="true" />
              Registrar constituyente
            </Button>
          </Can>
        }
      />

      {initialEditMissing ? (
        <Alert variant="warning">
          <AlertDescription>No se encontró el constituyente solicitado.</AlertDescription>
        </Alert>
      ) : null}

      {successMessage ? (
        <Alert ref={successAlertRef} variant="success" tabIndex={-1}>
          <CheckCircle2 className="size-4" aria-hidden="true" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <FormDialog
        open={panel.type === 'register' || panel.type === 'edit'}
        onOpenChange={(open) => {
          if (!open) {
            setPanel({ type: 'none' });
          }
        }}
        title={panel.type === 'edit' ? 'Editar constituyente' : 'Registrar constituyente'}
        description={
          panel.type === 'edit'
            ? 'Actualiza los datos de contacto y rol del constituyente.'
            : 'Registra una persona o institución vinculada al programa.'
        }
        size="md"
        onRestoreFocus={() => {
          if (submittedJustNowRef.current) {
            submittedJustNowRef.current = false;
            return;
          }
          restoreFocus();
        }}
      >
        {panel.type === 'register' ? (
          <StakeholderForm
            key="register-new"
            mode="register"
            inDialog
            onCancel={() => setPanel({ type: 'none' })}
            onSaved={handleSaved}
            onSelectExisting={(existing) => setPanel({ type: 'edit', stakeholder: existing })}
          />
        ) : panel.type === 'edit' ? (
          <StakeholderForm
            key={`edit-${panel.stakeholder.id}`}
            mode="edit"
            inDialog
            initialStakeholder={panel.stakeholder}
            onCancel={() => setPanel({ type: 'none' })}
            onSaved={handleSaved}
            onSelectExisting={(existing) => setPanel({ type: 'edit', stakeholder: existing })}
          />
        ) : null}
      </FormDialog>

      <ConfirmDialog
        open={panel.type === 'void'}
        onOpenChange={(open) => {
          if (!open) {
            voidMutation.reset();
            setPanel({ type: 'none' });
          }
        }}
        title="Anular constituyente"
        description={
          panel.type === 'void'
            ? `${panel.stakeholder.fullName} · ${getStakeholderDocumentLabel(panel.stakeholder)}. El constituyente no se elimina: queda en el registro como anulado.`
            : ''
        }
        confirmLabel="Confirmar anulación"
        pendingLabel="Anulando…"
        tone="destructive"
        isPending={voidMutation.isPending}
        error={voidMutation.error ? getStakeholderErrorMessage(voidMutation.error) : null}
        reason={{
          label: 'Motivo de la anulación',
          minLength: STAKEHOLDER_VOID_REASON_MIN_LENGTH,
          maxLength: STAKEHOLDER_VOID_REASON_MAX_LENGTH,
        }}
        onConfirm={async (reason) => {
          if (voidMutation.isPending || !reason || panel.type !== 'void') {
            return;
          }
          try {
            const updated = await voidMutation.mutateAsync({
              id: panel.stakeholder.id,
              payload: { reason },
            });
            handleVoided(updated);
          } catch {
            // El error de servidor queda disponible en voidMutation.error.
          }
        }}
      />

      <StakeholdersFilters value={filters} onApply={handleApplyFilters} />

      {query.isLoading ? (
        <LoadingState message="Cargando registro de constituyentes…" />
      ) : query.isError ? (
        query.error.status === 403 ? (
          <ErrorState
            title="Acceso denegado"
            message="No tienes permiso para consultar el registro de constituyentes."
          />
        ) : (
          <ErrorState
            title="No se pudo cargar el registro"
            message={getStakeholderErrorMessage(query.error)}
            onRetry={() => {
              void query.refetch();
            }}
          />
        )
      ) : items.length === 0 ? (
        hasFilters ? (
          <EmptyState
            illustration="noResults"
            title="Sin resultados"
            description="No se encontraron constituyentes con los criterios seleccionados."
          />
        ) : (
          <EmptyState
            title="No hay constituyentes registrados"
            description="Registra una persona o institución para iniciar el registro maestro."
          />
        )
      ) : (
        <div className="space-y-4">
          <StakeholdersTable
            items={items}
            onEdit={(stakeholder) => {
              captureFocus();
              setSuccessMessage(null);
              setPanel({ type: 'edit', stakeholder });
            }}
            onVoid={(stakeholder) => {
              setSuccessMessage(null);
              setPanel({ type: 'void', stakeholder });
            }}
          />
          <StakeholdersPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </section>
  );
}
