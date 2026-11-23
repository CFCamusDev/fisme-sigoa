import { useEffect, useRef, useState } from 'react';
import {
  PROCESS_EXECUTION_YEAR_MAX,
  PROCESS_EXECUTION_YEAR_MIN,
  type ProcessExecutionDto,
} from '@sigoa/shared';
import { CheckCircle2, Plus } from 'lucide-react';
import { Can } from '@/components/common/can';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { FormDialog } from '@/components/common/form-dialog';
import { LoadingState } from '@/components/common/loading-state';
import { PageHeader } from '@/components/common/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useRestoreFocus } from '@/hooks/use-restore-focus';
import { useProcessExecutions } from '../hooks/use-process-executions';
import { getProcessExecutionErrorMessage } from '../lib/process-execution-error-message';
import { ProcessExecutionForm } from './process-execution-form';
import {
  ProcessExecutionsFilters,
  type ProcessExecutionsFiltersState,
} from './process-executions-filters';
import { ProcessExecutionsPagination } from './process-executions-pagination';
import { ProcessExecutionsTable } from './process-executions-table';

const PAGE_SIZE = 20;

const INITIAL_FILTERS: ProcessExecutionsFiltersState = {
  type: '',
  year: '',
  status: '',
};

export function ProcessExecutionsPage() {
  const [filters, setFilters] = useState<ProcessExecutionsFiltersState>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successAlertRef = useRef<HTMLDivElement>(null);
  const createdJustNowRef = useRef(false);
  const { remember, restore } = useRestoreFocus();

  const parsedYear = Number.parseInt(filters.year, 10);
  const validYear =
    filters.year.trim().length === 4 &&
    Number.isInteger(parsedYear) &&
    parsedYear >= PROCESS_EXECUTION_YEAR_MIN &&
    parsedYear <= PROCESS_EXECUTION_YEAR_MAX
      ? parsedYear
      : undefined;

  const query = useProcessExecutions({
    type: filters.type || undefined,
    year: validYear,
    status: filters.status || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  useEffect(() => {
    if (successMessage) {
      successAlertRef.current?.focus();
    }
  }, [successMessage]);

  function handleFiltersChange(next: ProcessExecutionsFiltersState) {
    setFilters(next);
    setPage(1);
  }

  function handleResetFilters() {
    setFilters(INITIAL_FILTERS);
    setPage(1);
  }

  function handleCreated(execution: ProcessExecutionDto) {
    createdJustNowRef.current = true;
    setIsCreating(false);
    setSuccessMessage(`Ejecución «${execution.name}» creada en estado Planificado.`);
  }

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = query.data?.totalPages ?? 0;
  const hasFilters = Boolean(filters.type || filters.year || filters.status);

  return (
    <section className="space-y-6 bg-background text-foreground">
      <PageHeader
        title="Ejecuciones de proceso"
        description="Organiza las ejecuciones de los procesos de Objetivos Educacionales y Atributos del Graduado."
        actions={
          <Can permission="ejecucion.crear">
            <Button
              type="button"
              onClick={(event) => {
                remember(event.currentTarget);
                createdJustNowRef.current = false;
                setSuccessMessage(null);
                setIsCreating(true);
              }}
            >
              <Plus className="mr-2 size-4" aria-hidden="true" />
              Nueva ejecución
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

      <FormDialog
        open={isCreating}
        onOpenChange={setIsCreating}
        title="Nueva ejecución"
        description="Selecciona el proceso, periodo y versión de catálogo para iniciar en estado Planificado."
        size="md"
        onRestoreFocus={() => {
          if (!createdJustNowRef.current) {
            restore();
          }
        }}
      >
        <ProcessExecutionForm
          inDialog
          onCreated={handleCreated}
          onCancel={() => setIsCreating(false)}
        />
      </FormDialog>

      <ProcessExecutionsFilters
        value={filters}
        onChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      {query.isLoading ? <LoadingState message="Cargando ejecuciones de proceso…" /> : null}

      {query.isError ? (
        <ErrorState
          message={getProcessExecutionErrorMessage(query.error)}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : null}

      {!query.isLoading && !query.isError && items.length === 0 ? (
        <EmptyState
          title={
            hasFilters
              ? 'No se encontraron ejecuciones con esos filtros.'
              : 'Aún no hay ejecuciones. Crea la primera para organizar el trabajo del periodo.'
          }
          action={
            hasFilters ? (
              <Button type="button" variant="outline" onClick={handleResetFilters}>
                Limpiar filtros
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {!query.isLoading && !query.isError && items.length > 0 ? (
        <div className="space-y-4">
          <ProcessExecutionsTable items={items} />
          <ProcessExecutionsPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </section>
  );
}
