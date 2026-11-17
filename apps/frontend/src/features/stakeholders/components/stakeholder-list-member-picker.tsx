import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, CheckCircle2, Search, UserPlus, X } from 'lucide-react';
import type { StakeholderDto, StakeholderListDto, StakeholderListMemberDto } from '@sigoa/shared';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAddStakeholderListMember } from '../hooks/use-add-stakeholder-list-member';
import { useStakeholders } from '../hooks/use-stakeholders';
import { STAKEHOLDER_KIND_LABELS, getStakeholderDocumentLabel } from '../lib/stakeholder-labels';
import {
  getMissingListMemberFields,
  getStakeholderListErrorMessage,
} from '../lib/stakeholder-list-error-message';
import {
  STAKEHOLDER_LIST_EXTRA_FIELD,
  STAKEHOLDER_LIST_PICKER_KIND,
  STAKEHOLDER_LIST_TYPE_LABELS,
} from '../lib/stakeholder-list-labels';
import { StakeholdersPagination } from './stakeholders-pagination';

const PICKER_PAGE_SIZE = 10;

export interface StakeholderListMemberPickerProps {
  readonly list: StakeholderListDto;
  readonly onMemberAdded?: (member: StakeholderListMemberDto) => void;
  readonly onClose?: () => void;
}

export function StakeholderListMemberPicker({
  list,
  onMemberAdded,
  onClose,
}: StakeholderListMemberPickerProps) {
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [extraValue, setExtraValue] = useState('');
  const [extraError, setExtraError] = useState<string | null>(null);
  const [pendingStakeholderId, setPendingStakeholderId] = useState<string | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  const extraField = STAKEHOLDER_LIST_EXTRA_FIELD[list.type];
  const helperKind = STAKEHOLDER_LIST_PICKER_KIND[list.type];

  const query = useStakeholders({
    search: appliedSearch || undefined,
    kind: helperKind,
    status: 'ACTIVE',
    page,
    pageSize: PICKER_PAGE_SIZE,
  });

  const addMutation = useAddStakeholderListMember();

  useEffect(() => {
    if (missingFields.length > 0 || actionError) {
      alertRef.current?.focus();
    }
  }, [missingFields, actionError]);

  const existingIds = new Set((list.members ?? []).map((member) => member.stakeholderId));
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = query.data?.totalPages ?? 0;

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
    setPage(1);
  }

  async function submitMember(stakeholder: StakeholderDto, extra?: string) {
    setMissingFields([]);
    setActionError(null);
    setPendingStakeholderId(stakeholder.id);

    try {
      const added = await addMutation.mutateAsync({
        listId: list.id,
        stakeholderId: stakeholder.id,
        ...(extraField?.key === 'activity' ? { activity: extra } : {}),
        ...(extraField?.key === 'representative' ? { representative: extra } : {}),
      });
      setExpandedId(null);
      setExtraValue('');
      setExtraError(null);
      onMemberAdded?.(added);
    } catch (error) {
      const missing = getMissingListMemberFields(error);
      if (missing.length > 0) {
        setMissingFields(missing);
      } else {
        setActionError(getStakeholderListErrorMessage(error));
      }
    } finally {
      setPendingStakeholderId(null);
    }
  }

  function handleAddClick(stakeholder: StakeholderDto) {
    setMissingFields([]);
    setActionError(null);

    if (extraField) {
      setExpandedId(stakeholder.id);
      setExtraValue('');
      setExtraError(null);
      return;
    }

    void submitMember(stakeholder);
  }

  function handleExtraSubmit(event: React.FormEvent, stakeholder: StakeholderDto) {
    event.preventDefault();
    const trimmed = extraValue.trim();
    if (!trimmed) {
      setExtraError(`Ingresa el campo ${extraField?.label.toLowerCase()} para continuar.`);
      return;
    }
    setExtraError(null);
    void submitMember(stakeholder, trimmed);
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6 text-card-foreground">
      <div className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Agregar constituyentes del registro maestro</h3>
          <p className="text-sm text-muted-foreground">
            Lista de {STAKEHOLDER_LIST_TYPE_LABELS[list.type]} {list.year}. Solo se muestran
            constituyentes activos.
          </p>
        </div>
        {onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Cerrar selector"
          >
            <X className="size-4" aria-hidden="true" />
            Cerrar
          </Button>
        ) : null}
      </div>

      <div className="space-y-4">
        {missingFields.length > 0 ? (
          <Alert ref={alertRef} variant="warning" role="alert" tabIndex={-1}>
            <AlertTriangle className="size-4" aria-hidden="true" />
            <AlertTitle>Datos incompletos en el registro maestro</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>Falta en el registro del constituyente: {missingFields.join(', ')}.</p>
              <Link
                to="/constituyentes"
                className="inline-block font-medium text-foreground underline underline-offset-4"
              >
                Completar el registro
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}

        {actionError ? (
          <Alert ref={alertRef} variant="danger" role="alert" tabIndex={-1}>
            <AlertTriangle className="size-4" aria-hidden="true" />
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-end gap-3">
          <div className="min-w-60 flex-1 space-y-1.5">
            <Label htmlFor="picker-search">Buscar por nombre, DNI o RUC</Label>
            <Input
              id="picker-search"
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Ej. Tech Amazonas, 20123456789 o 45678912"
            />
          </div>
          <Button type="submit" variant="outline">
            <Search className="mr-2 size-4" aria-hidden="true" />
            Buscar
          </Button>
        </form>

        {query.isLoading ? <LoadingState message="Buscando constituyentes…" /> : null}

        {query.isError ? (
          <ErrorState
            message={getStakeholderListErrorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : null}

        {!query.isLoading && !query.isError && items.length === 0 ? (
          <EmptyState
            title="No se encontraron constituyentes activos"
            description="Prueba con otro término de búsqueda o registra el constituyente en el maestro."
          />
        ) : null}

        {!query.isLoading && !query.isError && items.length > 0 ? (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <caption className="sr-only">
                  Constituyentes activos disponibles para agregar a la lista
                </caption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Nombre o razón social</TableHead>
                    <TableHead scope="col">Tipo</TableHead>
                    <TableHead scope="col">Documento</TableHead>
                    <TableHead scope="col">Cargo / Institución</TableHead>
                    <TableHead scope="col" className="text-right">
                      Acción
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const alreadyInList = existingIds.has(item.id);
                    const isPending = addMutation.isPending && pendingStakeholderId === item.id;
                    const isExpanded = expandedId === item.id;
                    const detailParts = [item.position, item.institution].filter(
                      (part): part is string => Boolean(part),
                    );
                    const detail = detailParts.length > 0 ? detailParts.join(' · ') : '—';

                    return (
                      <Fragment key={item.id}>
                        <TableRow>
                          <TableCell className="font-medium text-foreground">
                            {item.fullName}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {STAKEHOLDER_KIND_LABELS[item.kind]}
                          </TableCell>
                          <TableCell className="text-foreground">
                            {getStakeholderDocumentLabel(item)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{detail}</TableCell>
                          <TableCell className="text-right">
                            {alreadyInList ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                <CheckCircle2 className="size-4" aria-hidden="true" />
                                En la lista
                              </span>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={addMutation.isPending}
                                aria-label={`Agregar ${item.fullName} a la lista`}
                                onClick={() => handleAddClick(item)}
                              >
                                <UserPlus className="mr-1.5 size-4" aria-hidden="true" />
                                {isPending ? 'Agregando…' : 'Agregar'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>

                        {isExpanded && extraField ? (
                          <TableRow className="bg-muted/40">
                            <TableCell colSpan={5} className="p-4">
                              <form
                                onSubmit={(event) => handleExtraSubmit(event, item)}
                                className="flex flex-wrap items-end gap-3"
                              >
                                <div className="min-w-64 flex-1 space-y-1.5">
                                  <Label htmlFor={`picker-extra-${item.id}`}>
                                    {extraField.label}
                                  </Label>
                                  <Input
                                    id={`picker-extra-${item.id}`}
                                    type="text"
                                    value={extraValue}
                                    onChange={(event) => setExtraValue(event.target.value)}
                                    placeholder={extraField.placeholder}
                                  />
                                  {extraError ? (
                                    <p className="text-xs text-destructive">{extraError}</p>
                                  ) : null}
                                </div>
                                <div className="flex gap-2">
                                  <Button type="submit" size="sm" disabled={addMutation.isPending}>
                                    {isPending ? 'Agregando…' : 'Confirmar'}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={addMutation.isPending}
                                    onClick={() => {
                                      setExpandedId(null);
                                      setExtraValue('');
                                      setExtraError(null);
                                    }}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </form>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <StakeholdersPagination
              page={page}
              pageSize={PICKER_PAGE_SIZE}
              totalPages={totalPages}
              total={total}
              onPageChange={setPage}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
