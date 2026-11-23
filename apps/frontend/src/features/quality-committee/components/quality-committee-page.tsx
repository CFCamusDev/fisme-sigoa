import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type {
  QualityCommitteeDto,
  RegisterQualityCommitteeRequest,
  ReplaceCommitteeMembersRequest,
} from '@sigoa/shared';
import { PageHeader } from '@/components/common';
import { Can } from '@/components/common/can';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRestoreFocus } from '@/hooks/use-restore-focus';
import { useTabParam } from '@/hooks/use-tab-param';
import {
  useCurrentQualityCommittee,
  useQualityCommittees,
  useRegisterQualityCommittee,
  useReplaceCommitteeMembers,
} from '../hooks';
import { formatCommitteePeriod } from '../lib/committee-dates';
import { getCommitteeErrorMessage } from '../lib/committee-error-message';
import { CommitteeForm } from './committee-form';
import { CommitteeHistoryTable } from './committee-history-table';
import { CurrentCommitteeCard } from './current-committee-card';
import { PresidentAlerts } from './president-alerts';

const COMMITTEE_TABS = ['vigente', 'historial'] as const;

type FormState =
  | { readonly kind: 'closed' }
  | { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly committee: QualityCommitteeDto };

export function QualityCommitteePage() {
  const [tab, setTab] = useTabParam(COMMITTEE_TABS, 'vigente');
  const [page, setPage] = useState(1);
  const [formState, setFormState] = useState<FormState>({ kind: 'closed' });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutationErrorDetail, setMutationErrorDetail] = useState<unknown>(null);
  const sheetTitleRef = useRef<HTMLHeadingElement>(null);
  const { remember, restore } = useRestoreFocus();

  const currentQuery = useCurrentQualityCommittee();
  const historyQuery = useQualityCommittees({ page, pageSize: 10 });
  const registerMutation = useRegisterQualityCommittee();
  const replaceMutation = useReplaceCommitteeMembers();

  const isSubmitting = registerMutation.isPending || replaceMutation.isPending;

  async function handleCreateSubmit(payload: RegisterQualityCommitteeRequest) {
    setMutationError(null);
    setMutationErrorDetail(null);
    try {
      await registerMutation.mutateAsync(payload);
      setStatusMessage('Comité de Calidad registrado correctamente.');
      setFormState({ kind: 'closed' });
    } catch (error) {
      setMutationError(getCommitteeErrorMessage(error));
      setMutationErrorDetail(error);
    }
  }

  async function handleEditSubmit(committeeId: string, payload: ReplaceCommitteeMembersRequest) {
    setMutationError(null);
    setMutationErrorDetail(null);
    try {
      await replaceMutation.mutateAsync({ committeeId, body: payload });
      setStatusMessage('Miembros del Comité de Calidad actualizados correctamente.');
      setFormState({ kind: 'closed' });
    } catch (error) {
      setMutationError(getCommitteeErrorMessage(error));
      setMutationErrorDetail(error);
    }
  }

  function handleOpenCreate(opener?: HTMLElement | null) {
    remember(opener ?? (document.activeElement as HTMLElement | null));
    setStatusMessage(null);
    setMutationError(null);
    setMutationErrorDetail(null);
    setFormState({ kind: 'create' });
  }

  function handleOpenEdit(committee: QualityCommitteeDto) {
    remember(document.activeElement as HTMLElement | null);
    setStatusMessage(null);
    setMutationError(null);
    setMutationErrorDetail(null);
    setFormState({ kind: 'edit', committee });
  }

  function handleCloseForm() {
    setMutationError(null);
    setMutationErrorDetail(null);
    setFormState({ kind: 'closed' });
  }

  return (
    <section className="space-y-6 bg-background text-foreground">
      <PageHeader
        title="Comité de Calidad"
        description="Gestiona la conformación vigente y el historial del Comité de Calidad por periodo."
        actions={
          <Can permission="comite.editar">
            <Button type="button" onClick={(event) => handleOpenCreate(event.currentTarget)}>
              <Plus className="mr-2 size-4" aria-hidden="true" />
              Registrar Comité
            </Button>
          </Can>
        }
      />

      {statusMessage && (
        <Alert variant="success" role="status">
          <AlertDescription>{statusMessage}</AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList aria-label="Secciones del Comité de Calidad">
          <TabsTrigger value="vigente">Vigente</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="vigente" className="space-y-6">
          {currentQuery.isPending && (
            <div
              role="status"
              className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground"
            >
              Cargando el Comité de Calidad…
            </div>
          )}

          {currentQuery.isError && (
            <Alert variant="danger">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>{getCommitteeErrorMessage(currentQuery.error)}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void currentQuery.refetch();
                    void historyQuery.refetch();
                  }}
                >
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {currentQuery.isSuccess && (
            <>
              <PresidentAlerts alerts={currentQuery.data.alerts} />

              {currentQuery.data.committee ? (
                <CurrentCommitteeCard
                  committee={currentQuery.data.committee}
                  actorMembership={currentQuery.data.actorMembership}
                  onEditMembers={handleOpenEdit}
                />
              ) : (
                <section className="rounded-lg border border-border bg-card p-6 text-card-foreground">
                  <Can
                    permission="comite.editar"
                    fallback={
                      <p className="text-sm text-muted-foreground">
                        Aún no se registró el Comité del periodo actual.
                      </p>
                    }
                  >
                    <p className="text-sm text-muted-foreground">
                      No hay un Comité vigente. Registra el Comité del periodo actual.
                    </p>
                  </Can>
                </section>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="historial" className="space-y-6">
          {historyQuery.isPending && (
            <div
              role="status"
              className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground"
            >
              Cargando historial del Comité…
            </div>
          )}

          {historyQuery.isError && (
            <Alert variant="danger">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>{getCommitteeErrorMessage(historyQuery.error)}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void historyQuery.refetch()}
                >
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {historyQuery.isSuccess && (
            <CommitteeHistoryTable
              data={historyQuery.data}
              onPageChange={setPage}
              onEditMembers={handleOpenEdit}
            />
          )}
        </TabsContent>
      </Tabs>

      <Sheet
        open={formState.kind !== 'closed'}
        onOpenChange={(isOpen) => {
          if (!isOpen && !isSubmitting) {
            handleCloseForm();
          }
        }}
      >
        <SheetContent
          size="lg"
          showCloseButton={!isSubmitting}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            sheetTitleRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restore();
          }}
          onEscapeKeyDown={(event) => {
            if (isSubmitting) {
              event.preventDefault();
            }
          }}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          {formState.kind !== 'closed' && (
            <>
              <SheetHeader>
                <SheetTitle ref={sheetTitleRef} tabIndex={-1} className="focus:outline-none">
                  {formState.kind === 'edit'
                    ? formatCommitteePeriod(
                        formState.committee.periodStart,
                        formState.committee.periodEnd,
                      )
                    : 'Registrar Comité de Calidad'}
                </SheetTitle>
                <SheetDescription>
                  {formState.kind === 'edit'
                    ? `Periodo (solo lectura): ${formatCommitteePeriod(
                        formState.committee.periodStart,
                        formState.committee.periodEnd,
                      )}`
                    : 'Define las fechas del periodo y registra al menos un Presidente. Un periodo equivocado se corrige registrando un Comité nuevo.'}
                </SheetDescription>
              </SheetHeader>

              <CommitteeForm
                key={formState.kind === 'edit' ? formState.committee.id : 'create'}
                mode={formState.kind}
                initialCommittee={formState.kind === 'edit' ? formState.committee : null}
                inPanel
                isSubmitting={isSubmitting}
                serverError={mutationError}
                serverErrorDetail={mutationErrorDetail}
                onCancel={handleCloseForm}
                onSubmitCreate={handleCreateSubmit}
                onSubmitEdit={handleEditSubmit}
              />
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
