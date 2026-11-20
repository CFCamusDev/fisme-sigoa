import { useState } from 'react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { ArrowDown, ArrowUp, Check, Play, Trash2, X } from 'lucide-react';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/date';
import { SCHEDULE_ACTIVITY_STATUS_DISPLAY, SCHEDULE_OVERDUE_DISPLAY } from '../lib/schedule-labels';
import type {
  ScheduleActivityFormItem,
  ScheduleEditorFormValues,
} from '../schemas/schedule-editor-schema';

export interface ScheduleActivityRowProps {
  readonly index: number;
  readonly total: number;
  readonly item: ScheduleActivityFormItem;
  readonly canEdit: boolean;
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly isChangingStatus: boolean;
  readonly register: UseFormRegister<ScheduleEditorFormValues>;
  readonly errors?: FieldErrors<ScheduleActivityFormItem>;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
  readonly onRemove: () => void;
  readonly onStart: () => void;
  readonly onComplete: (actualEndDate?: string) => void;
}

export function ScheduleActivityRow({
  index,
  total,
  item,
  canEdit,
  isDirty,
  isSaving,
  isChangingStatus,
  register,
  errors,
  onMoveUp,
  onMoveDown,
  onRemove,
  onStart,
  onComplete,
}: ScheduleActivityRowProps) {
  const [completing, setCompleting] = useState(false);
  const [actualEndDate, setActualEndDate] = useState('');

  const rowNumber = index + 1;
  const statusDisplay = SCHEDULE_ACTIVITY_STATUS_DISPLAY[item.status];
  const canRemove = canEdit && (!item.id || item.status === 'PENDING');
  const canStart = canEdit && Boolean(item.id) && item.status === 'PENDING';
  const canComplete = canEdit && Boolean(item.id) && item.status === 'IN_PROGRESS';

  function handleConfirmComplete() {
    const trimmed = actualEndDate.trim();
    onComplete(trimmed.length > 0 ? trimmed : undefined);
    setCompleting(false);
    setActualEndDate('');
  }

  return (
    <TableRow className="align-top">
      <TableCell className="w-12 font-medium text-foreground">{rowNumber}</TableCell>

      <TableCell className="min-w-56">
        {canEdit ? (
          <div className="space-y-1">
            <Input
              aria-label={`Actividad ${rowNumber}`}
              {...register(`activities.${index}.activity`)}
              disabled={isSaving}
            />
            {errors?.activity?.message ? (
              <p className="text-xs text-destructive" role="alert">
                {errors.activity.message}
              </p>
            ) : null}
          </div>
        ) : (
          <span className="text-foreground">{item.activity}</span>
        )}
      </TableCell>

      <TableCell className="min-w-40">
        {canEdit ? (
          <div className="space-y-1">
            <Input
              aria-label={`Responsable ${rowNumber}`}
              {...register(`activities.${index}.responsible`)}
              disabled={isSaving}
            />
            {errors?.responsible?.message ? (
              <p className="text-xs text-destructive" role="alert">
                {errors.responsible.message}
              </p>
            ) : null}
          </div>
        ) : (
          <span className="text-foreground">{item.responsible}</span>
        )}
      </TableCell>

      <TableCell className="min-w-40">
        {canEdit ? (
          <Input
            aria-label={`Meta ${rowNumber}`}
            {...register(`activities.${index}.goal`)}
            disabled={isSaving}
          />
        ) : (
          <span className="text-muted-foreground">{item.goal || '—'}</span>
        )}
      </TableCell>

      <TableCell className="min-w-40">
        {canEdit ? (
          <Input
            aria-label={`Indicador ${rowNumber}`}
            {...register(`activities.${index}.indicator`)}
            disabled={isSaving}
          />
        ) : (
          <span className="text-muted-foreground">{item.indicator || '—'}</span>
        )}
      </TableCell>

      <TableCell className="min-w-36">
        {canEdit ? (
          <Input
            type="date"
            aria-label={`Fecha de inicio ${rowNumber}`}
            {...register(`activities.${index}.startDate`)}
            disabled={isSaving}
          />
        ) : (
          <span className="text-foreground">{formatDate(item.startDate || null)}</span>
        )}
      </TableCell>

      <TableCell className="min-w-36">
        {canEdit ? (
          <div className="space-y-1">
            <Input
              type="date"
              aria-label={`Fecha de fin ${rowNumber}`}
              {...register(`activities.${index}.endDate`)}
              disabled={isSaving}
            />
            {errors?.endDate?.message ? (
              <p className="text-xs text-destructive" role="alert">
                {errors.endDate.message}
              </p>
            ) : null}
          </div>
        ) : (
          <span className="text-foreground">{formatDate(item.endDate || null)}</span>
        )}
      </TableCell>

      <TableCell className="min-w-40">
        <div className="flex flex-col items-start gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge status={statusDisplay.statusKey} label={statusDisplay.label} />
            {item.isOverdue ? (
              <StatusBadge
                status={SCHEDULE_OVERDUE_DISPLAY.statusKey}
                label={SCHEDULE_OVERDUE_DISPLAY.label}
              />
            ) : null}
          </div>
          {item.status === 'COMPLETED' && item.actualEndDate ? (
            <span className="text-xs text-muted-foreground">
              Real: {formatDate(item.actualEndDate)}
            </span>
          ) : null}
        </div>
      </TableCell>

      {canEdit ? (
        <TableCell className="min-w-52">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Subir actividad ${rowNumber}`}
                disabled={index === 0 || isSaving}
                onClick={onMoveUp}
              >
                <ArrowUp className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Subir</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Bajar actividad ${rowNumber}`}
                disabled={index === total - 1 || isSaving}
                onClick={onMoveDown}
              >
                <ArrowDown className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Bajar</span>
              </Button>
              {canRemove ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Quitar actividad ${rowNumber}`}
                  disabled={isSaving}
                  onClick={onRemove}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">Quitar</span>
                </Button>
              ) : null}
              {canStart ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isDirty || isSaving || isChangingStatus}
                  onClick={onStart}
                >
                  <Play className="size-3.5" aria-hidden="true" />
                  Iniciar
                </Button>
              ) : null}
              {canComplete && !completing ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isDirty || isSaving || isChangingStatus}
                  onClick={() => setCompleting(true)}
                >
                  <Check className="size-3.5" aria-hidden="true" />
                  Completar
                </Button>
              ) : null}
            </div>

            {completing ? (
              <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/40 p-2">
                <Label htmlFor={`actual-end-date-${rowNumber}`} className="text-xs text-foreground">
                  Fecha real de término (opcional)
                </Label>
                <Input
                  id={`actual-end-date-${rowNumber}`}
                  type="date"
                  value={actualEndDate}
                  onChange={(event) => setActualEndDate(event.target.value)}
                  disabled={isChangingStatus}
                />
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    disabled={isChangingStatus}
                    onClick={handleConfirmComplete}
                  >
                    Confirmar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isChangingStatus}
                    onClick={() => {
                      setCompleting(false);
                      setActualEndDate('');
                    }}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </TableCell>
      ) : null}
    </TableRow>
  );
}
