import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
import {
  SCHEDULE_MAX_ITEMS,
  type SaveScheduleRequest,
  type ScheduleActivityDto,
} from '@sigoa/shared';
import { Calendar, Plus, Save, Sparkles } from 'lucide-react';
import { Can } from '@/components/common/can';
import { EmptyState } from '@/components/common/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePermission } from '@/hooks/use-permission';
import {
  createEmptyFormItem,
  mapDtoToFormItem,
  scheduleEditorFormSchema,
  toSaveScheduleRequest,
  type ScheduleEditorFormValues,
} from '../schemas/schedule-editor-schema';
import { ScheduleActivityRow } from './schedule-activity-row';

export interface ScheduleEditorProps {
  readonly items: readonly ScheduleActivityDto[];
  readonly isProposing: boolean;
  readonly isSaving: boolean;
  readonly isChangingStatus: boolean;
  readonly errorMessage: string | null;
  readonly onPropose: () => void;
  readonly onSave: (payload: SaveScheduleRequest) => void;
  readonly onStartActivity: (activityId: string) => void;
  readonly onCompleteActivity: (activityId: string, actualEndDate?: string) => void;
}

export function ScheduleEditor({
  items,
  isProposing,
  isSaving,
  isChangingStatus,
  errorMessage,
  onPropose,
  onSave,
  onStartActivity,
  onCompleteActivity,
}: ScheduleEditorProps) {
  const canEdit = usePermission('cronograma.editar');

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ScheduleEditorFormValues>({
    resolver: zodResolver(scheduleEditorFormSchema),
    defaultValues: {
      activities: items.map(mapDtoToFormItem),
    },
  });

  const { fields, append, move, remove } = useFieldArray({
    control,
    name: 'activities',
  });

  useEffect(() => {
    reset({ activities: items.map(mapDtoToFormItem) });
  }, [items, reset]);

  const isBusy = isProposing || isSaving || isChangingStatus;

  const submitForm = handleSubmit((values) => {
    onSave(toSaveScheduleRequest(values));
  });

  if (fields.length === 0) {
    return (
      <div className="space-y-4">
        {errorMessage ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <EmptyState
          icon={Calendar}
          title="Aún no hay actividades en el cronograma"
          description="Puedes proponer los pasos oficiales del procedimiento o agregar actividades manualmente."
          action={
            <Can permission="cronograma.editar">
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" disabled={isBusy} onClick={onPropose}>
                  <Sparkles className="size-4" aria-hidden="true" />
                  {isProposing ? 'Proponiendo…' : 'Proponer actividades'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => append(createEmptyFormItem())}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Agregar actividad
                </Button>
              </div>
            </Can>
          }
        />
      </div>
    );
  }

  return (
    <form onSubmit={submitForm} className="space-y-4" noValidate>
      {errorMessage ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {canEdit && isDirty ? (
        <Alert role="status">
          <AlertDescription>Guarda los cambios antes de cambiar el estado.</AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border bg-card text-card-foreground">
        <Table>
          <caption className="sr-only">Actividades del cronograma de ejecución (Anexo 1)</caption>
          <TableHeader className="bg-muted text-foreground">
            <TableRow>
              <TableHead scope="col" className="w-12 text-foreground">
                N°
              </TableHead>
              <TableHead scope="col" className="text-foreground">
                Actividad
              </TableHead>
              <TableHead scope="col" className="text-foreground">
                Responsable
              </TableHead>
              <TableHead scope="col" className="text-foreground">
                Meta
              </TableHead>
              <TableHead scope="col" className="text-foreground">
                Indicador
              </TableHead>
              <TableHead scope="col" className="text-foreground">
                Inicio
              </TableHead>
              <TableHead scope="col" className="text-foreground">
                Fin
              </TableHead>
              <TableHead scope="col" className="text-foreground">
                Estado
              </TableHead>
              {canEdit ? (
                <TableHead scope="col" className="text-foreground">
                  Acciones
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
              <ScheduleActivityRow
                key={field.id}
                index={index}
                total={fields.length}
                item={field}
                canEdit={canEdit}
                isDirty={isDirty}
                isSaving={isSaving}
                isChangingStatus={isChangingStatus}
                register={register}
                errors={errors.activities?.[index]}
                onMoveUp={() => move(index, index - 1)}
                onMoveDown={() => move(index, index + 1)}
                onRemove={() => remove(index)}
                onStart={() => {
                  const serverId = items[index]?.id;
                  if (serverId) {
                    onStartActivity(serverId);
                  }
                }}
                onComplete={(actualEndDate) => {
                  const serverId = items[index]?.id;
                  if (serverId) {
                    onCompleteActivity(serverId, actualEndDate);
                  }
                }}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {canEdit ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={isBusy || fields.length >= SCHEDULE_MAX_ITEMS}
            onClick={() => append(createEmptyFormItem())}
          >
            <Plus className="size-4" aria-hidden="true" />
            Agregar actividad
          </Button>

          <Button type="submit" disabled={isBusy}>
            <Save className="size-4" aria-hidden="true" />
            {isSaving ? 'Guardando…' : 'Guardar cronograma'}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
