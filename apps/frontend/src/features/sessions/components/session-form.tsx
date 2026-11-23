import { useEffect, useId, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  SESSION_MODALITIES,
  STAKEHOLDER_LIST_TYPES,
  createSessionRequestSchema,
  type CreateSessionRequest,
  type SessionDto,
} from '@sigoa/shared';
import { AlertTriangle } from 'lucide-react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { STAKEHOLDER_LIST_TYPE_LABELS, useStakeholderLists } from '@/features/stakeholders';
import { usePermission } from '@/hooks/use-permission';
import { useCreateSession } from '../hooks/use-create-session';
import { useLinkableProcessExecutions } from '../hooks/use-linkable-process-executions';
import { useUpdateSession } from '../hooks/use-update-session';
import { getSessionErrorMessage } from '../lib/session-error-message';
import { SESSION_MODALITY_LABELS } from '../lib/session-labels';
import { SessionExecutionsField } from './session-executions-field';

export interface SessionFormProps {
  readonly defaultExecutionId?: string;
  readonly session?: SessionDto;
  readonly onSaved: (session: SessionDto) => void;
  readonly onCancel: () => void;
}

function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateYear(isoDate: string): number {
  const year = Number.parseInt(isoDate.split('-')[0] ?? '', 10);
  return Number.isInteger(year) ? year : new Date().getFullYear();
}

export function SessionForm({ defaultExecutionId, session, onSaved, onCancel }: SessionFormProps) {
  const uid = useId();
  const [serverError, setServerError] = useState<string | null>(null);
  const canReadStakeholderLists = usePermission('constituyente.ver');

  const isEditing = Boolean(session);
  const createMutation = useCreateSession();
  const updateMutation = useUpdateSession();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const linkableExecutionsQuery = useLinkableProcessExecutions();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateSessionRequest>({
    resolver: zodResolver(createSessionRequestSchema) as Resolver<CreateSessionRequest>,
    defaultValues: {
      stakeholderType: session?.stakeholderType ?? 'EMPLOYER',
      stakeholderListId: session?.stakeholderListId ?? null,
      sessionDate: session?.sessionDate ?? getTodayIsoDate(),
      startTime: session?.startTime ?? '10:00',
      modality: session?.modality ?? 'IN_PERSON',
      meetingUrl: session?.meetingUrl ?? '',
      recordingUrl: session?.recordingUrl ?? '',
      executionIds: session
        ? [...session.executionIds]
        : defaultExecutionId
          ? [defaultExecutionId]
          : [],
    },
  });

  useEffect(() => {
    if (session) {
      reset({
        stakeholderType: session.stakeholderType,
        stakeholderListId: session.stakeholderListId,
        sessionDate: session.sessionDate,
        startTime: session.startTime,
        modality: session.modality,
        meetingUrl: session.meetingUrl ?? '',
        recordingUrl: session.recordingUrl ?? '',
        executionIds: [...session.executionIds],
      });
    }
  }, [session, reset]);

  const selectedType = useWatch({ control, name: 'stakeholderType' });
  const selectedDate = useWatch({ control, name: 'sessionDate' });
  const selectedModality = useWatch({ control, name: 'modality' });
  const selectedListId = useWatch({ control, name: 'stakeholderListId' });
  const selectedExecutionIds = useWatch({ control, name: 'executionIds' });

  const listYear = useMemo(() => parseDateYear(selectedDate ?? ''), [selectedDate]);
  const listsQuery = useStakeholderLists({
    type: selectedType,
    year: listYear,
    includeMembers: false,
  });

  const availableLists = useMemo(() => {
    if (!canReadStakeholderLists || listsQuery.isError) {
      return [];
    }
    return listsQuery.data?.items ?? [];
  }, [canReadStakeholderLists, listsQuery.isError, listsQuery.data]);

  const isVirtual = selectedModality === 'VIRTUAL';
  const isHybrid = selectedModality === 'HYBRID';
  const showMeetingUrl = isVirtual || isHybrid;
  const showRecordingUrl = isVirtual || isHybrid;

  useEffect(() => {
    if (selectedModality === 'IN_PERSON') {
      setValue('meetingUrl', '');
      setValue('recordingUrl', '');
    }
  }, [selectedModality, setValue]);

  async function onSubmit(values: CreateSessionRequest) {
    setServerError(null);
    const isInPerson = values.modality === 'IN_PERSON';
    const normalizedPayload: CreateSessionRequest = {
      stakeholderType: values.stakeholderType,
      stakeholderListId: values.stakeholderListId || null,
      sessionDate: values.sessionDate,
      startTime: values.startTime,
      modality: values.modality,
      meetingUrl: isInPerson ? null : values.meetingUrl?.trim() ? values.meetingUrl.trim() : null,
      recordingUrl: isInPerson
        ? null
        : values.recordingUrl?.trim()
          ? values.recordingUrl.trim()
          : null,
      executionIds: values.executionIds,
    };

    try {
      const saved = session
        ? await updateMutation.mutateAsync({ id: session.id, data: normalizedPayload })
        : await createMutation.mutateAsync(normalizedPayload);
      onSaved(saved);
    } catch (error) {
      setServerError(getSessionErrorMessage(error));
    }
  }

  const stakeholderTypeId = `${uid}-stakeholderType`;
  const sessionDateId = `${uid}-sessionDate`;
  const startTimeId = `${uid}-startTime`;
  const modalityId = `${uid}-modality`;
  const stakeholderListId = `${uid}-stakeholderListId`;
  const meetingUrlId = `${uid}-meetingUrl`;
  const recordingUrlId = `${uid}-recordingUrl`;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-4 rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          {isEditing ? 'Editar sesión' : 'Registrar sesión'}
        </h2>
      </div>

      {serverError && (
        <Alert variant="danger">
          <AlertTriangle className="size-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={stakeholderTypeId}>Tipo de constituyente</Label>
          <Select id={stakeholderTypeId} {...register('stakeholderType')}>
            {STAKEHOLDER_LIST_TYPES.map((type) => (
              <option key={type} value={type}>
                {STAKEHOLDER_LIST_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
          {errors.stakeholderType && (
            <p className="text-xs text-destructive">{errors.stakeholderType.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={modalityId}>Modalidad</Label>
          <Select id={modalityId} {...register('modality')}>
            {SESSION_MODALITIES.map((modality) => (
              <option key={modality} value={modality}>
                {SESSION_MODALITY_LABELS[modality]}
              </option>
            ))}
          </Select>
          {errors.modality && <p className="text-xs text-destructive">{errors.modality.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={sessionDateId}>Fecha</Label>
          <Input id={sessionDateId} type="date" {...register('sessionDate')} />
          {errors.sessionDate && (
            <p className="text-xs text-destructive">{errors.sessionDate.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={startTimeId}>Hora de inicio</Label>
          <Input id={startTimeId} type="time" {...register('startTime')} />
          {errors.startTime && (
            <p className="text-xs text-destructive">{errors.startTime.message}</p>
          )}
        </div>
      </div>

      {canReadStakeholderLists && !listsQuery.isError ? (
        <div className="space-y-1.5">
          <Label htmlFor={stakeholderListId}>Lista del Anexo 3 (opcional)</Label>
          <Select
            id={stakeholderListId}
            value={selectedListId ?? ''}
            onChange={(event) =>
              setValue('stakeholderListId', event.target.value || null, {
                shouldValidate: true,
              })
            }
          >
            <option value="">Sin lista</option>
            {availableLists.map((list) => (
              <option key={list.id} value={list.id}>
                {STAKEHOLDER_LIST_TYPE_LABELS[list.type]} — {list.year}
                {list.version ? ` (v${list.version})` : ''}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No tienes acceso para consultar listas del Anexo 3; puedes registrar la sesión sin lista.
        </p>
      )}

      {(showMeetingUrl || showRecordingUrl) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {showMeetingUrl && (
            <div className="space-y-1.5">
              <Label htmlFor={meetingUrlId}>
                Enlace de la reunión
                <span className="text-destructive" aria-hidden="true">
                  {' '}
                  *
                </span>
                <span className="sr-only"> (obligatorio)</span>
              </Label>
              <Input
                id={meetingUrlId}
                type="url"
                placeholder="https://meet.ejemplo.edu.pe/..."
                aria-required="true"
                aria-invalid={Boolean(errors.meetingUrl)}
                aria-describedby={errors.meetingUrl ? `${meetingUrlId}-error` : undefined}
                {...register('meetingUrl')}
              />
              {errors.meetingUrl && (
                <p id={`${meetingUrlId}-error`} role="alert" className="text-xs text-destructive">
                  {errors.meetingUrl.message}
                </p>
              )}
            </div>
          )}

          {showRecordingUrl && (
            <div className="space-y-1.5">
              <Label htmlFor={recordingUrlId}>
                Enlace de la grabación
                {isVirtual ? (
                  <>
                    <span className="text-destructive" aria-hidden="true">
                      {' '}
                      *
                    </span>
                    <span className="sr-only"> (obligatorio)</span>
                  </>
                ) : (
                  ' (opcional)'
                )}
              </Label>
              <Input
                id={recordingUrlId}
                type="url"
                placeholder="https://drive.ejemplo.edu.pe/..."
                aria-required={isVirtual}
                aria-invalid={Boolean(errors.recordingUrl)}
                aria-describedby={errors.recordingUrl ? `${recordingUrlId}-error` : undefined}
                {...register('recordingUrl')}
              />
              {errors.recordingUrl && (
                <p id={`${recordingUrlId}-error`} role="alert" className="text-xs text-destructive">
                  {errors.recordingUrl.message}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <SessionExecutionsField
        linkableExecutions={linkableExecutionsQuery.items}
        selectedIds={selectedExecutionIds ?? []}
        lockedIds={session?.executionIds}
        isLoading={linkableExecutionsQuery.isLoading}
        errorMessage={errors.executionIds ? 'Selecciona al menos una ejecución' : undefined}
        onChange={(nextIds) =>
          setValue('executionIds', nextIds, {
            shouldValidate: true,
          })
        }
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Registrar sesión'}
        </Button>
      </div>
    </form>
  );
}
