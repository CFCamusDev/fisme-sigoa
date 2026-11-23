import { useEffect, useRef, useState } from 'react';
import { useForm, type Resolver, type ResolverResult } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  SCALE_TYPES,
  createResponseScaleRequestSchema,
  updateResponseScaleRequestSchema,
  type ResponseScaleDto,
} from '@sigoa/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCreateResponseScale } from '../hooks/use-create-response-scale';
import { useUpdateResponseScale } from '../hooks/use-update-response-scale';
import { getResponseScaleErrorMessage } from '../lib/response-scale-error-message';
import { getScaleTypeLabel } from '../lib/response-scale-labels';
import { EMPTY_LEVEL, ScaleLevelsEditor, type ScaleFormValues } from './scale-levels-editor';

export type ResponseScaleFormMode =
  { readonly kind: 'create' } | { readonly kind: 'edit'; readonly scale: ResponseScaleDto };

export interface ResponseScaleFormProps {
  mode: ResponseScaleFormMode;
  inDialog?: boolean;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

type Notice = { type: 'danger' | 'info'; title: string; message: string } | null;

function defaultValues(mode: ResponseScaleFormMode): ScaleFormValues {
  if (mode.kind === 'edit') {
    return {
      code: mode.scale.code,
      name: mode.scale.name,
      type: mode.scale.type,
      levels: mode.scale.levels.map((level) => ({
        label: level.label,
        value: level.value,
        countsAsAchievement: level.countsAsAchievement,
      })),
    };
  }
  return {
    code: '',
    name: '',
    type: 'LIKERT',
    levels: [{ ...EMPTY_LEVEL, value: 1 }, { ...EMPTY_LEVEL }],
  };
}

/** En edición el código y el tipo no cambian (D2): solo se validan el nombre y los niveles. */
function buildResolver(mode: ResponseScaleFormMode): Resolver<ScaleFormValues> {
  if (mode.kind === 'create') {
    return zodResolver(createResponseScaleRequestSchema) as unknown as Resolver<ScaleFormValues>;
  }
  const editResolver = zodResolver(updateResponseScaleRequestSchema) as unknown as Resolver<
    Pick<ScaleFormValues, 'name' | 'levels'>
  >;
  return async (values, context, options) =>
    (await editResolver(
      { name: values.name, levels: values.levels },
      context,
      options as never,
    )) as unknown as ResolverResult<ScaleFormValues>;
}

export function ResponseScaleForm({
  mode,
  inDialog = false,
  onCancel,
  onSaved,
}: ResponseScaleFormProps) {
  const createMutation = useCreateResponseScale();
  const updateMutation = useUpdateResponseScale();
  const isEdit = mode.kind === 'edit';
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [notice, setNotice] = useState<Notice>(null);
  const submittingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [initial] = useState(() => defaultValues(mode));

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<ScaleFormValues>({
    defaultValues: initial,
    resolver: buildResolver(mode),
  });

  useEffect(() => {
    if (!inDialog) {
      headingRef.current?.focus();
    }
  }, [inDialog]);

  const onSubmit = async (values: ScaleFormValues) => {
    if (submittingRef.current || isPending) {
      return;
    }
    setNotice(null);

    submittingRef.current = true;
    try {
      if (mode.kind === 'create') {
        await createMutation.mutateAsync({
          code: values.code,
          name: values.name,
          type: values.type,
          levels: values.levels,
        });
        onSaved('Escala creada.');
        return;
      }

      const before = initial;
      const nameChanged = values.name.trim() !== before.name;
      const levelsChanged =
        JSON.stringify(normalizeLevels(values)) !== JSON.stringify(normalizeLevels(before));
      if (!nameChanged && !levelsChanged) {
        setNotice({ type: 'info', title: 'Sin cambios', message: 'No hay cambios que guardar.' });
        return;
      }

      await updateMutation.mutateAsync({
        id: mode.scale.id,
        body: {
          ...(nameChanged ? { name: values.name } : {}),
          ...(levelsChanged ? { levels: values.levels } : {}),
        },
      });
      onSaved('Escala actualizada.');
    } catch (error: unknown) {
      const message = getResponseScaleErrorMessage(error);
      const status = (error as { status?: number } | null)?.status;
      if (mode.kind === 'create' && status === 409) {
        setError('code', { type: 'server', message });
        return;
      }
      setNotice({ type: 'danger', title: 'No se pudo guardar la escala', message });
    } finally {
      submittingRef.current = false;
    }
  };

  const codeError = errors.code?.message;
  const nameError = errors.name?.message;
  const typeError = errors.type?.message;

  return (
    <div
      className={
        inDialog
          ? undefined
          : 'rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm'
      }
    >
      {!inDialog && (
        <>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-lg font-semibold tracking-tight text-foreground focus:outline-none"
          >
            {isEdit ? 'Editar escala' : 'Nueva escala'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEdit
              ? 'Cambia el nombre o los niveles. El código y el tipo no se pueden modificar.'
              : 'Define el código, el nombre, el tipo y los niveles de la escala.'}
          </p>
        </>
      )}

      {notice && (
        <div className="mt-4">
          <Alert
            variant={notice.type === 'danger' ? 'danger' : 'default'}
            role={notice.type === 'danger' ? 'alert' : 'status'}
          >
            <AlertTitle>{notice.title}</AlertTitle>
            <AlertDescription>{notice.message}</AlertDescription>
          </Alert>
        </div>
      )}

      <form
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event);
        }}
        className="mt-6 space-y-6"
        noValidate
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isEdit ? (
            <dl className="space-y-1 text-sm sm:col-span-2">
              <div className="flex gap-2">
                <dt className="font-semibold text-foreground">Código:</dt>
                <dd className="text-muted-foreground">{mode.scale.code}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold text-foreground">Tipo:</dt>
                <dd className="text-muted-foreground">{getScaleTypeLabel(mode.scale.type)}</dd>
              </div>
            </dl>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="scale-code">Código</Label>
                <Input
                  id="scale-code"
                  type="text"
                  autoComplete="off"
                  maxLength={60}
                  aria-invalid={!!codeError}
                  aria-describedby={
                    codeError ? 'scale-code-help scale-code-error' : 'scale-code-help'
                  }
                  className={cn(codeError && 'border-destructive focus-visible:ring-destructive')}
                  {...register('code')}
                />
                <p id="scale-code-help" className="text-meta text-muted-foreground">
                  De 2 a 40 caracteres: mayúsculas, números y guion bajo, empezando por una letra.
                  No se puede cambiar después.
                </p>
                {codeError && (
                  <p id="scale-code-error" role="alert" className="text-meta text-destructive">
                    {codeError}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="scale-type">Tipo</Label>
                <Select
                  id="scale-type"
                  aria-invalid={!!typeError}
                  aria-describedby={typeError ? 'scale-type-error' : undefined}
                  {...register('type')}
                >
                  {SCALE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {getScaleTypeLabel(type)}
                    </option>
                  ))}
                </Select>
                {typeError && (
                  <p id="scale-type-error" role="alert" className="text-meta text-destructive">
                    {typeError}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="scale-name">Nombre</Label>
            <Input
              id="scale-name"
              type="text"
              maxLength={200}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? 'scale-name-error' : undefined}
              className={cn(nameError && 'border-destructive focus-visible:ring-destructive')}
              {...register('name')}
            />
            {nameError && (
              <p id="scale-name-error" role="alert" className="text-meta text-destructive">
                {nameError}
              </p>
            )}
          </div>
        </div>

        <ScaleLevelsEditor control={control} register={register} errors={errors} />

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Guardando…' : 'Guardar escala'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function normalizeLevels(values: Pick<ScaleFormValues, 'levels'>) {
  return values.levels.map((level) => ({
    label: level.label.trim(),
    value: level.value,
    countsAsAchievement: level.countsAsAchievement,
  }));
}
