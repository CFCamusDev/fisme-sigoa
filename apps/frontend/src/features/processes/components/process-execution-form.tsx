import { useEffect, useId, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  PROCESS_EXECUTION_NAME_MAX_LENGTH,
  PROCESS_EXECUTION_YEAR_MAX,
  PROCESS_EXECUTION_YEAR_MIN,
  PROCESS_TYPES,
  createProcessExecutionRequestSchema,
  type CreateProcessExecutionRequest,
  type ProcessExecutionDto,
  type ProcessTypeValue,
} from '@sigoa/shared';
import { AlertTriangle } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useCatalogVersions } from '@/features/catalog';
import { useSemesters } from '@/features/parameters';
import { useCreateProcessExecution } from '../hooks/use-create-process-execution';
import {
  filterEligibleCatalogVersions,
  formatCatalogVersionOptionLabel,
  getRequiredVersionLabel,
} from '../lib/process-catalog-version-filter';
import { getProcessExecutionErrorMessage } from '../lib/process-execution-error-message';
import { PROCESS_TYPE_LABELS, getSuggestedExecutionName } from '../lib/process-type-labels';

export interface ProcessExecutionFormProps {
  readonly onCreated: (execution: ProcessExecutionDto) => void;
  readonly onCancel: () => void;
}

function parseSemesterYear(code?: string | null): number | null {
  if (!code) {
    return null;
  }
  const match = /^(\d{4})-/.exec(code.trim());
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

interface ProcessExecutionFormValues {
  type: ProcessTypeValue | '';
  year: number;
  semesterId?: string | null;
  catalogVersionId: string;
  name?: string | null;
}

export function ProcessExecutionForm({ onCreated, onCancel }: ProcessExecutionFormProps) {
  const uid = useId();
  const [serverError, setServerError] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const defaultYear =
    currentYear >= PROCESS_EXECUTION_YEAR_MIN && currentYear <= PROCESS_EXECUTION_YEAR_MAX
      ? currentYear
      : 2027;

  const catalogQuery = useCatalogVersions();
  const semestersQuery = useSemesters();
  const createMutation = useCreateProcessExecution();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<ProcessExecutionFormValues>({
    resolver: zodResolver(createProcessExecutionRequestSchema) as never,
    defaultValues: {
      type: '',
      year: defaultYear,
      semesterId: '',
      catalogVersionId: '',
      name: '',
    },
  });

  const selectedType = useWatch({ control, name: 'type' });
  const selectedYear = useWatch({ control, name: 'year' });
  const selectedSemesterId = useWatch({ control, name: 'semesterId' });
  const selectedCatalogVersionId = useWatch({ control, name: 'catalogVersionId' });

  const eligibleVersions = useMemo(
    () => filterEligibleCatalogVersions(selectedType, catalogQuery.data?.items ?? []),
    [selectedType, catalogQuery.data?.items],
  );

  const semesters = useMemo(() => semestersQuery.data?.items ?? [], [semestersQuery.data?.items]);

  const selectedSemester = useMemo(
    () => semesters.find((item) => item.id === selectedSemesterId) ?? null,
    [semesters, selectedSemesterId],
  );

  // Sincroniza la versión elegible única o limpia si ya no aplica al tipo seleccionado
  useEffect(() => {
    const stillValid = eligibleVersions.some((v) => v.id === selectedCatalogVersionId);
    if (stillValid) {
      return;
    }
    if (eligibleVersions.length === 1 && eligibleVersions[0]) {
      setValue('catalogVersionId', eligibleVersions[0].id, { shouldValidate: false });
    } else if (selectedCatalogVersionId) {
      setValue('catalogVersionId', '', { shouldValidate: false });
    }
  }, [eligibleVersions, selectedCatalogVersionId, setValue]);

  // Limpia o sincroniza el semestre y su año cuando cambia el tipo o el semestre elegido
  useEffect(() => {
    if (selectedType !== 'P622') {
      if (selectedSemesterId) {
        setValue('semesterId', undefined, { shouldValidate: false });
      }
      return;
    }
    if (!selectedSemesterId && semesters.length === 1 && semesters[0]) {
      setValue('semesterId', semesters[0].id, { shouldValidate: false });
      const semYear = parseSemesterYear(semesters[0].code);
      if (semYear !== null) {
        setValue('year', semYear, { shouldValidate: false });
      }
      return;
    }
    if (selectedSemester) {
      const semYear = parseSemesterYear(selectedSemester.code);
      if (semYear !== null && semYear !== selectedYear) {
        setValue('year', semYear, { shouldValidate: false });
      }
    }
  }, [selectedType, selectedSemesterId, selectedSemester, selectedYear, semesters, setValue]);

  const isP622 = selectedType === 'P622';
  const catalogForbidden = catalogQuery.isError && catalogQuery.error.status === 403;
  const semestersForbidden =
    isP622 && semestersQuery.isError && semestersQuery.error.status === 403;
  const noEligibleVersion =
    selectedType !== '' &&
    !catalogQuery.isLoading &&
    !catalogForbidden &&
    eligibleVersions.length === 0;
  const noSemestersAvailable =
    isP622 && !semestersQuery.isLoading && !semestersForbidden && semesters.length === 0;

  const missingPermissionMessage = catalogForbidden
    ? 'No tienes el permiso necesario (catalogo.ver) para consultar las versiones de catálogo.'
    : semestersForbidden
      ? 'No tienes el permiso necesario (parametro.ver) para consultar los semestres.'
      : null;

  const suggestedName = selectedType
    ? getSuggestedExecutionName(
        selectedType,
        Number.isFinite(selectedYear) ? selectedYear : defaultYear,
        selectedSemester?.code ?? null,
      )
    : `Ejecución ${Number.isFinite(selectedYear) ? selectedYear : defaultYear}`;

  const onSubmit = handleSubmit(async (data) => {
    if (!data.type) {
      return;
    }
    setServerError(null);
    const trimmedName = data.name?.trim() ?? '';
    const payload: CreateProcessExecutionRequest = {
      type: data.type,
      year: data.year,
      catalogVersionId: data.catalogVersionId,
      ...(data.type === 'P622' && data.semesterId ? { semesterId: data.semesterId } : {}),
      ...(trimmedName.length > 0 ? { name: trimmedName } : {}),
    };

    try {
      const created = await createMutation.mutateAsync(payload);
      onCreated(created);
    } catch (error) {
      setServerError(getProcessExecutionErrorMessage(error));
    }
  });

  return (
    <section
      aria-labelledby={`${uid}-title`}
      className="space-y-4 rounded-lg border border-border bg-card p-6 text-card-foreground"
    >
      <div className="space-y-1">
        <h2 id={`${uid}-title`} className="text-lg font-semibold">
          Nueva ejecución de proceso
        </h2>
        <p className="text-sm text-muted-foreground">
          Selecciona el proceso, periodo y versión de catálogo para iniciar en estado Planificado.
        </p>
      </div>

      {missingPermissionMessage ? (
        <Alert variant="danger" role="alert">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertDescription>{missingPermissionMessage}</AlertDescription>
        </Alert>
      ) : null}

      {serverError ? (
        <Alert variant="danger" role="alert">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-type`}>Proceso</Label>
            <Select id={`${uid}-type`} aria-invalid={Boolean(errors.type)} {...register('type')}>
              <option value="">Selecciona un proceso</option>
              {PROCESS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PROCESS_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
            {errors.type ? (
              <p className="text-xs text-destructive" role="alert">
                {errors.type.message}
              </p>
            ) : null}
          </div>

          {isP622 ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-semester`}>Semestre</Label>
              <Select
                id={`${uid}-semester`}
                aria-invalid={Boolean(errors.semesterId)}
                disabled={semestersQuery.isLoading || semestersForbidden || noSemestersAvailable}
                {...register('semesterId')}
              >
                <option value="">Selecciona un semestre</option>
                {semesters.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.code}
                  </option>
                ))}
              </Select>
              {noSemestersAvailable ? (
                <p className="text-xs text-muted-foreground">
                  No hay semestres registrados. Configura un semestre antes de crear una medición
                  directa.
                </p>
              ) : null}
              {errors.semesterId ? (
                <p className="text-xs text-destructive" role="alert">
                  {errors.semesterId.message}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-year`}>Año</Label>
              <Input
                id={`${uid}-year`}
                type="number"
                min={PROCESS_EXECUTION_YEAR_MIN}
                max={PROCESS_EXECUTION_YEAR_MAX}
                aria-invalid={Boolean(errors.year)}
                {...register('year', { valueAsNumber: true })}
              />
              {errors.year ? (
                <p className="text-xs text-destructive" role="alert">
                  {errors.year.message}
                </p>
              ) : null}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-catalog-version`}>Versión de catálogo</Label>
            <Select
              id={`${uid}-catalog-version`}
              aria-invalid={Boolean(errors.catalogVersionId)}
              disabled={catalogQuery.isLoading || catalogForbidden || noEligibleVersion}
              {...register('catalogVersionId')}
            >
              <option value="">Selecciona una versión</option>
              {eligibleVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  {formatCatalogVersionOptionLabel(version)}
                </option>
              ))}
            </Select>
            {noEligibleVersion ? (
              <p className="text-xs text-muted-foreground">
                No existe una versión de catálogo en estado «{getRequiredVersionLabel(selectedType)}
                » para este proceso.
              </p>
            ) : null}
            {errors.catalogVersionId ? (
              <p className="text-xs text-destructive" role="alert">
                {errors.catalogVersionId.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-name`}>Nombre (opcional)</Label>
            <Input
              id={`${uid}-name`}
              type="text"
              maxLength={PROCESS_EXECUTION_NAME_MAX_LENGTH}
              aria-invalid={Boolean(errors.name)}
              placeholder={suggestedName}
              {...register('name')}
            />
            <p className="text-xs text-muted-foreground">
              Si lo dejas vacío se usará «{suggestedName}».
            </p>
            {errors.name ? (
              <p className="text-xs text-destructive" role="alert">
                {errors.name.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={
              createMutation.isPending ||
              Boolean(missingPermissionMessage) ||
              noEligibleVersion ||
              noSemestersAvailable
            }
          >
            {createMutation.isPending ? 'Guardando…' : 'Crear ejecución'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
}
