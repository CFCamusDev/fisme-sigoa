import {
  useFieldArray,
  useWatch,
  type FieldErrors,
  type UseFormRegister,
  type Control,
} from 'react-hook-form';
import {
  SCALE_MAX_LEVELS,
  SCALE_MAX_VALUE,
  SCALE_MIN_LEVELS,
  SCALE_MIN_VALUE,
} from '@sigoa/shared';
import type { ScaleTypeValue } from '@sigoa/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface ScaleFormLevel {
  label: string;
  value: number;
  countsAsAchievement: boolean;
}

export interface ScaleFormValues {
  code: string;
  name: string;
  type: ScaleTypeValue;
  levels: ScaleFormLevel[];
}

export interface ScaleLevelsEditorProps {
  control: Control<ScaleFormValues>;
  register: UseFormRegister<ScaleFormValues>;
  errors: FieldErrors<ScaleFormValues>;
  disabled?: boolean;
}

export const EMPTY_LEVEL: ScaleFormLevel = { label: '', value: 0, countsAsAchievement: false };

/**
 * Editor de niveles sin arrastrar y soltar (D34): subir, bajar, quitar y agregar con botones, para
 * que sea operable por teclado. El orden de cada nivel es su posición en la lista.
 */
export function ScaleLevelsEditor({ control, register, errors, disabled }: ScaleLevelsEditorProps) {
  const { fields, append, remove, move } = useFieldArray({ control, name: 'levels' });
  const watched = useWatch({ control, name: 'levels' });
  const listError = errors.levels?.message ?? errors.levels?.root?.message;
  const atMin = fields.length <= SCALE_MIN_LEVELS;
  const atMax = fields.length >= SCALE_MAX_LEVELS;

  return (
    <fieldset
      className="space-y-3 rounded-md border border-border p-4"
      aria-describedby="scale-levels-help"
    >
      <legend className="px-1 text-label text-foreground">Niveles de la escala</legend>
      <p id="scale-levels-help" className="text-meta text-muted-foreground">
        De {SCALE_MIN_LEVELS} a {SCALE_MAX_LEVELS} niveles. El orden es el de la lista; el valor es
        un entero de {SCALE_MIN_VALUE} a {SCALE_MAX_VALUE}, distinto en cada nivel.
      </p>

      <ul className="space-y-3">
        {fields.map((field, index) => {
          const levelNumber = index + 1;
          const currentLabel = watched?.[index]?.label?.trim() || 'sin etiqueta';
          const rowErrors = errors.levels?.[index];
          const labelError = rowErrors?.label?.message;
          const valueError = rowErrors?.value?.message;
          const flagError = rowErrors?.countsAsAchievement?.message;
          const labelErrorId = `scale-level-${field.id}-label-error`;
          const valueErrorId = `scale-level-${field.id}-value-error`;
          const flagErrorId = `scale-level-${field.id}-flag-error`;

          return (
            <li key={field.id}>
              <fieldset className="rounded-md border border-border bg-card p-3">
                <legend className="px-1 text-meta font-semibold text-foreground">
                  Nivel {levelNumber}
                </legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem_auto]">
                  <div className="space-y-1.5">
                    <Label htmlFor={`scale-level-${field.id}-label`}>
                      Etiqueta<span className="sr-only"> del nivel {levelNumber}</span>
                    </Label>
                    <Input
                      id={`scale-level-${field.id}-label`}
                      type="text"
                      maxLength={200}
                      disabled={disabled}
                      aria-invalid={!!labelError}
                      aria-describedby={labelError ? labelErrorId : undefined}
                      className={cn(
                        labelError && 'border-destructive focus-visible:ring-destructive',
                      )}
                      {...register(`levels.${index}.label` as const)}
                    />
                    {labelError && (
                      <p id={labelErrorId} role="alert" className="text-meta text-destructive">
                        {labelError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`scale-level-${field.id}-value`}>
                      Valor<span className="sr-only"> del nivel {levelNumber}</span>
                    </Label>
                    <Input
                      id={`scale-level-${field.id}-value`}
                      type="number"
                      inputMode="numeric"
                      min={SCALE_MIN_VALUE}
                      max={SCALE_MAX_VALUE}
                      step={1}
                      disabled={disabled}
                      aria-invalid={!!valueError}
                      aria-describedby={valueError ? valueErrorId : undefined}
                      className={cn(
                        'tabular',
                        valueError && 'border-destructive focus-visible:ring-destructive',
                      )}
                      {...register(`levels.${index}.value` as const, { valueAsNumber: true })}
                    />
                    {valueError && (
                      <p id={valueErrorId} role="alert" className="text-meta text-destructive">
                        {valueError}
                      </p>
                    )}
                  </div>

                  <div className="flex items-end gap-2 pb-2">
                    <Checkbox
                      id={`scale-level-${field.id}-flag`}
                      disabled={disabled}
                      aria-invalid={!!flagError}
                      aria-describedby={flagError ? flagErrorId : undefined}
                      {...register(`levels.${index}.countsAsAchievement` as const)}
                    />
                    <Label htmlFor={`scale-level-${field.id}-flag`}>
                      Cuenta como logro<span className="sr-only"> del nivel {levelNumber}</span>
                    </Label>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || index === 0}
                    aria-label={`Subir nivel ${levelNumber}: ${currentLabel}`}
                    onClick={() => move(index, index - 1)}
                  >
                    Subir
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || index === fields.length - 1}
                    aria-label={`Bajar nivel ${levelNumber}: ${currentLabel}`}
                    onClick={() => move(index, index + 1)}
                  >
                    Bajar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || atMin}
                    aria-label={`Quitar nivel ${levelNumber}: ${currentLabel}`}
                    onClick={() => remove(index)}
                  >
                    Quitar
                  </Button>
                </div>
              </fieldset>
            </li>
          );
        })}
      </ul>

      {listError && (
        <p id="scale-levels-error" role="alert" className="text-meta text-destructive">
          {listError}
        </p>
      )}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled || atMax}
        onClick={() => append({ ...EMPTY_LEVEL })}
      >
        Agregar nivel
      </Button>
      {atMax && (
        <p className="text-meta text-muted-foreground">
          Llegaste al máximo de {SCALE_MAX_LEVELS} niveles.
        </p>
      )}
    </fieldset>
  );
}
