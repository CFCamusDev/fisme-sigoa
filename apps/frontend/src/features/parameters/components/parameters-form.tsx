import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  PARAMETER_DEFINITIONS,
  PARAMETER_KEYS,
  PARAMETER_WEIGHTS_TOTAL,
  defineParametersRequestSchema,
  type ParameterKey,
} from '@sigoa/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Can } from '@/components/common/can';
import { usePermission } from '@/hooks/use-permission';
import { cn } from '@/lib/utils';
import { useDefineParameters } from '../hooks/use-define-parameters';
import { useParameters } from '../hooks/use-parameters';
import { useSemesters } from '../hooks/use-semesters';
import {
  buildDefineParametersPayload,
  toFormValues,
  type ParameterFormValues,
} from '../lib/build-define-parameters-payload';
import { getParameterErrorMessage } from '../lib/parameter-error-message';

const EMPTY_VALUES: ParameterFormValues = {
  UMBRAL_LOGRADO: '',
  META_AG: '',
  PESO_DIRECTA: '',
  PESO_INDIRECTA: '',
  MIN_PARTICIPACION: '',
  TOKEN_DIAS: '',
  LOGIN_INTENTOS: '',
};

const WEIGHT_KEYS: readonly ParameterKey[] = ['PESO_DIRECTA', 'PESO_INDIRECTA'];
const OTHER_KEYS = PARAMETER_KEYS.filter((key) => !WEIGHT_KEYS.includes(key));

/** Ayuda de cada campo; TOKEN_DIAS no promete efecto en otros flujos (bitácora B-01). */
const EXTRA_HELP: Partial<Record<ParameterKey, string>> = {
  TOKEN_DIAS: 'Vigencia del enlace de invitación a encuestas.',
  LOGIN_INTENTOS: 'Intentos fallidos de inicio de sesión antes de bloquear la cuenta.',
};

type Notice = { type: 'success' | 'danger' | 'info'; title: string; message: string } | null;

export interface ParametersFormProps {
  onSuccess?: (semesterCode: string) => void;
}

export function ParametersForm({ onSuccess }: ParametersFormProps) {
  const { allowed: canEdit } = usePermission('parametro.editar', 'GLOBAL');
  const defineMutation = useDefineParameters();
  const { data: semesters } = useSemesters();

  const [semesterCode, setSemesterCode] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ParameterKey, string>>>({});
  const [weightsError, setWeightsError] = useState<string | null>(null);
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const { data: current } = useParameters(semesterCode || undefined, {
    enabled: semesterCode !== '',
  });

  const { register, handleSubmit, reset, control, formState } = useForm<ParameterFormValues>({
    defaultValues: EMPTY_VALUES,
  });

  // Precarga los valores vigentes del semestre elegido (sin pisar lo que la persona ya editó).
  useEffect(() => {
    if (current && current.semesterCode === semesterCode && !formState.isDirty) {
      reset(toFormValues(current.items));
    }
  }, [current, semesterCode, formState.isDirty, reset]);

  const [directText, indirectText] = useWatch({
    control,
    name: ['PESO_DIRECTA', 'PESO_INDIRECTA'],
  });
  const rawSum = Number(directText || 0) + Number(indirectText || 0);
  const weightsSum = Number.isFinite(rawSum) ? rawSum : 0;

  if (!canEdit) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
        <p className="text-sm text-muted-foreground">
          Solo lectura: no tienes permiso para modificar los parámetros.
        </p>
      </div>
    );
  }

  const clearErrors = () => {
    setFieldErrors({});
    setWeightsError(null);
    setSemesterError(null);
  };

  const onSemesterChange = (code: string) => {
    setSemesterCode(code);
    setNotice(null);
    clearErrors();
    reset(EMPTY_VALUES);
  };

  const onSubmit = async (values: ParameterFormValues) => {
    if (submittingRef.current || defineMutation.isPending) {
      return;
    }
    setNotice(null);
    clearErrors();

    if (semesterCode === '') {
      setSemesterError('Elige el semestre desde el que rigen los valores.');
      return;
    }

    const payload = buildDefineParametersPayload({
      semesterCode,
      current: current?.items ?? [],
      values,
    });

    if (payload === null) {
      setNotice({
        type: 'info',
        title: 'Sin cambios',
        message: 'No hay cambios que guardar.',
      });
      return;
    }

    const parsed = defineParametersRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const nextFieldErrors: Partial<Record<ParameterKey, string>> = {};
      let nextWeightsError: string | null = null;
      for (const issue of parsed.error.issues) {
        const [, index] = issue.path;
        const key = typeof index === 'number' ? payload.values[index]?.key : undefined;
        if (key) {
          nextFieldErrors[key] ??= issue.message;
        } else {
          nextWeightsError ??= issue.message;
        }
      }
      setFieldErrors(nextFieldErrors);
      setWeightsError(nextWeightsError);
      return;
    }

    submittingRef.current = true;
    try {
      const saved = await defineMutation.mutateAsync(parsed.data);
      reset(toFormValues(saved.items));
      setNotice({
        type: 'success',
        title: 'Parámetros guardados',
        message: `Parámetros guardados. Rigen desde el semestre ${parsed.data.semesterCode}.`,
      });
      onSuccess?.(parsed.data.semesterCode);
    } catch (error: unknown) {
      setNotice({
        type: 'danger',
        title: 'No se pudieron guardar los parámetros',
        message: getParameterErrorMessage(error),
      });
    } finally {
      submittingRef.current = false;
    }
  };

  const onFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    void handleSubmit(onSubmit)(event);
  };

  const renderField = (key: ParameterKey) => {
    const definition = PARAMETER_DEFINITIONS[key];
    const error = fieldErrors[key];
    const helpId = `parameter-${key}-help`;
    const errorId = `parameter-${key}-error`;
    return (
      <div key={key} className="space-y-1.5">
        <Label htmlFor={`parameter-${key}`}>{definition.label}</Label>
        <Input
          id={`parameter-${key}`}
          type="number"
          inputMode="numeric"
          min={definition.min}
          max={definition.max}
          step={1}
          aria-describedby={error ? `${helpId} ${errorId}` : helpId}
          aria-invalid={!!error}
          className={cn('tabular', error && 'border-destructive focus-visible:ring-destructive')}
          {...register(key)}
        />
        <p id={helpId} className="text-meta text-muted-foreground">
          Entero entre {definition.min} y {definition.max}. {EXTRA_HELP[key] ?? ''}
        </p>
        {error && (
          <p id={errorId} role="alert" className="text-meta text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <Can permission="parametro.editar" scope="GLOBAL">
      <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Definir parámetros</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Los valores nuevos rigen desde el semestre que elijas; los semestres anteriores no
          cambian.
        </p>

        {notice && (
          <div className="mt-4">
            <Alert
              variant={
                notice.type === 'success'
                  ? 'success'
                  : notice.type === 'danger'
                    ? 'danger'
                    : 'default'
              }
              role={notice.type === 'danger' ? 'alert' : 'status'}
            >
              <AlertTitle>{notice.title}</AlertTitle>
              <AlertDescription>{notice.message}</AlertDescription>
            </Alert>
          </div>
        )}

        <form onSubmit={onFormSubmit} className="mt-6 space-y-6" noValidate>
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="parameters-form-semester">Vigente desde el semestre</Label>
            <Select
              id="parameters-form-semester"
              value={semesterCode}
              onChange={(event) => onSemesterChange(event.target.value)}
              aria-invalid={!!semesterError}
              aria-describedby={semesterError ? 'parameters-form-semester-error' : undefined}
            >
              <option value="">Selecciona un semestre</option>
              {(semesters?.items ?? []).map((semester) => (
                <option key={semester.id} value={semester.code}>
                  {semester.code}
                </option>
              ))}
            </Select>
            {semesterError && (
              <p
                id="parameters-form-semester-error"
                role="alert"
                className="text-meta text-destructive"
              >
                {semesterError}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{OTHER_KEYS.map(renderField)}</div>

          <fieldset
            className="space-y-3 rounded-md border border-border p-4"
            aria-describedby={weightsError ? 'parameters-weights-error' : 'parameters-weights-sum'}
          >
            <legend className="px-1 text-label text-foreground">Pesos de la medición</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {WEIGHT_KEYS.map(renderField)}
            </div>
            <p id="parameters-weights-sum" aria-live="polite" className="text-sm text-foreground">
              Suma actual: {weightsSum} de {PARAMETER_WEIGHTS_TOTAL}
              {weightsSum === PARAMETER_WEIGHTS_TOTAL ? ' (correcto)' : ' (debe ser 100)'}
            </p>
            {weightsError && (
              <p id="parameters-weights-error" role="alert" className="text-meta text-destructive">
                {weightsError}
              </p>
            )}
          </fieldset>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={defineMutation.isPending}>
              {defineMutation.isPending ? 'Guardando…' : 'Guardar parámetros'}
            </Button>
          </div>
        </form>
      </div>
    </Can>
  );
}
