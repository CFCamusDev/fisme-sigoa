import { useEffect, useRef, useState } from 'react';
import { Copy, UserPlus, CheckCircle2 } from 'lucide-react';
import type {
  CopyStakeholderListResponse,
  CopyStakeholderListSkippedItem,
  StakeholderListDto,
  StakeholderListTypeValue,
} from '@sigoa/shared';
import { Can } from '@/components/common/can';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { PageHeader } from '@/components/common/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useStakeholderLists } from '../hooks/use-stakeholder-lists';
import { getStakeholderListErrorMessage } from '../lib/stakeholder-list-error-message';
import { STAKEHOLDER_LIST_TYPE_LABELS } from '../lib/stakeholder-list-labels';
import { CopyStakeholderListForm } from './copy-stakeholder-list-form';
import { CreateStakeholderListForm } from './create-stakeholder-list-form';
import {
  StakeholderListFilters,
  type StakeholderListFiltersValue,
} from './stakeholder-list-filters';
import { StakeholderListMemberPicker } from './stakeholder-list-member-picker';
import { StakeholderListMembersTable } from './stakeholder-list-members-table';

type ActivePanel = 'none' | 'picker' | 'copy';

const numberFormatter = new Intl.NumberFormat('es-PE');

export function StakeholderListsPage() {
  const [filters, setFilters] = useState<StakeholderListFiltersValue>({
    type: 'EMPLOYER' as StakeholderListTypeValue,
    year: new Date().getFullYear(),
  });
  const [activePanel, setActivePanel] = useState<ActivePanel>('none');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [skippedItems, setSkippedItems] = useState<readonly CopyStakeholderListSkippedItem[]>([]);
  const successAlertRef = useRef<HTMLDivElement>(null);

  const query = useStakeholderLists({
    type: filters.type,
    year: filters.year,
    includeMembers: true,
  });

  useEffect(() => {
    if (successMessage) {
      successAlertRef.current?.focus();
    }
  }, [successMessage]);

  const list: StakeholderListDto | null = query.data?.items[0] ?? null;
  const members = list?.members ?? [];

  function handleApplyFilters(next: StakeholderListFiltersValue) {
    setFilters(next);
    setActivePanel('none');
    setSuccessMessage(null);
    setSkippedItems([]);
  }

  function handleCreated(created: StakeholderListDto) {
    setActivePanel('none');
    setSkippedItems([]);
    setSuccessMessage(
      `Lista de ${STAKEHOLDER_LIST_TYPE_LABELS[created.type]} ${created.year} creada correctamente.`,
    );
  }

  function handleCopied(response: CopyStakeholderListResponse) {
    setActivePanel('none');
    setFilters({ type: response.list.type, year: response.list.year });
    setSkippedItems(response.skipped);
    setSuccessMessage(
      `Se copiaron ${numberFormatter.format(response.list.memberCount)} miembros a la lista ${response.list.year}.`,
    );
  }

  return (
    <section className="space-y-6 bg-background text-foreground">
      <PageHeader
        title="Listas del Anexo 3"
        description="Conformación de listas de constituyentes por tipo y año según el procedimiento del programa."
      />

      <StakeholderListFilters value={filters} onApply={handleApplyFilters} />

      {successMessage ? (
        <Alert ref={successAlertRef} variant="success" role="status" tabIndex={-1}>
          <CheckCircle2 className="size-4" aria-hidden="true" />
          <AlertTitle>{successMessage}</AlertTitle>
          {skippedItems.length > 0 ? (
            <AlertDescription>
              <p className="mt-1">
                Se omitieron {numberFormatter.format(skippedItems.length)} constituyentes al copiar:
              </p>
              <ul className="mt-1 list-disc pl-5">
                {skippedItems.map((item) => (
                  <li key={item.stakeholderId}>
                    {item.fullName} — {item.reason === 'VOIDED' ? 'Anulado' : 'Registro incompleto'}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          ) : null}
        </Alert>
      ) : null}

      {query.isLoading ? <LoadingState message="Cargando lista del Anexo 3…" /> : null}

      {query.isError ? (
        <ErrorState
          title={query.error.status === 403 ? 'Acceso denegado' : undefined}
          message={getStakeholderListErrorMessage(query.error)}
          onRetry={query.error.status === 403 ? undefined : () => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.isError && !list ? (
        <div className="space-y-4">
          <EmptyState
            title={`No existe lista de ${STAKEHOLDER_LIST_TYPE_LABELS[filters.type]} para ${filters.year}`}
            description="Crea la lista para empezar a incorporar constituyentes del registro maestro."
          />
          <Can permission="constituyente.editar">
            <CreateStakeholderListForm
              type={filters.type}
              year={filters.year}
              onCreated={handleCreated}
            />
          </Can>
        </div>
      ) : null}

      {!query.isLoading && !query.isError && list ? (
        <div className="space-y-4">
          <div className="space-y-4 rounded-lg border border-border bg-card p-6 text-card-foreground">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">
                  {STAKEHOLDER_LIST_TYPE_LABELS[list.type]} — {list.year}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Total de miembros: {numberFormatter.format(list.memberCount)}
                  {list.studyPlanNumber ? ` · Plan: ${list.studyPlanNumber}` : ''}
                  {list.version ? ` · Versión: ${list.version}` : ''}
                </p>
              </div>

              <Can permission="constituyente.editar">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() =>
                      setActivePanel((current) => (current === 'picker' ? 'none' : 'picker'))
                    }
                  >
                    <UserPlus className="mr-2 size-4" aria-hidden="true" />
                    Agregar constituyentes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setActivePanel((current) => (current === 'copy' ? 'none' : 'copy'))
                    }
                  >
                    <Copy className="mr-2 size-4" aria-hidden="true" />
                    Copiar para nuevo año
                  </Button>
                </div>
              </Can>
            </div>

            {members.length === 0 ? (
              <div>
                <EmptyState
                  title="La lista aún no tiene miembros"
                  description="Usa el botón «Agregar constituyentes» para seleccionar personas o instituciones del registro maestro."
                />
              </div>
            ) : null}
          </div>

          {activePanel === 'picker' ? (
            <StakeholderListMemberPicker
              list={list}
              onMemberAdded={(added) => {
                setSkippedItems([]);
                setSuccessMessage(`Se agregó "${added.fullName}" a la lista.`);
              }}
              onClose={() => setActivePanel('none')}
            />
          ) : null}

          {activePanel === 'copy' ? (
            <CopyStakeholderListForm
              sourceList={list}
              onCopied={handleCopied}
              onCancel={() => setActivePanel('none')}
            />
          ) : null}

          {members.length > 0 ? (
            <StakeholderListMembersTable type={list.type} year={list.year} members={members} />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
