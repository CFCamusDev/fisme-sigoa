import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';
import type { StakeholderDto } from '@sigoa/shared';
import { Can } from '@/components/common/can';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { PageHeader } from '@/components/common/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useStakeholders } from '../hooks/use-stakeholders';
import { getStakeholderErrorMessage } from '../lib/stakeholder-error-message';
import { StakeholderForm } from './stakeholder-form';
import { StakeholdersFilters, type StakeholdersFiltersState } from './stakeholders-filters';
import { StakeholdersPagination } from './stakeholders-pagination';
import { StakeholdersTable } from './stakeholders-table';
import { VoidStakeholderForm } from './void-stakeholder-form';

const PAGE_SIZE = 20;

type ActivePanel =
  | { readonly type: 'none' }
  | { readonly type: 'register' }
  | { readonly type: 'edit'; readonly stakeholder: StakeholderDto }
  | { readonly type: 'void'; readonly stakeholder: StakeholderDto };

export function StakeholdersPage() {
  const [filters, setFilters] = useState<StakeholdersFiltersState>({
    search: '',
    kind: '',
    status: '',
  });
  const [page, setPage] = useState(1);
  const [panel, setPanel] = useState<ActivePanel>({ type: 'none' });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successAlertRef = useRef<HTMLDivElement>(null);

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

  function handleApplyFilters(next: StakeholdersFiltersState) {
    setFilters(next);
    setPage(1);
  }

  function handleSaved(stakeholder: StakeholderDto, mode: 'register' | 'edit') {
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

      {successMessage ? (
        <Alert ref={successAlertRef} variant="success" tabIndex={-1}>
          <CheckCircle2 className="size-4" aria-hidden="true" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {panel.type === 'register' ? (
        <StakeholderForm
          key="register-new"
          mode="register"
          onCancel={() => setPanel({ type: 'none' })}
          onSaved={handleSaved}
          onSelectExisting={(existing) => setPanel({ type: 'edit', stakeholder: existing })}
        />
      ) : null}

      {panel.type === 'edit' ? (
        <StakeholderForm
          key={`edit-${panel.stakeholder.id}`}
          mode="edit"
          initialStakeholder={panel.stakeholder}
          onCancel={() => setPanel({ type: 'none' })}
          onSaved={handleSaved}
          onSelectExisting={(existing) => setPanel({ type: 'edit', stakeholder: existing })}
        />
      ) : null}

      {panel.type === 'void' ? (
        <VoidStakeholderForm
          key={`void-${panel.stakeholder.id}`}
          stakeholder={panel.stakeholder}
          onCancel={() => setPanel({ type: 'none' })}
          onVoided={handleVoided}
        />
      ) : null}

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
            illustration="no-results"
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
