import { useEffect, useId, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert } from 'lucide-react';
import {
  registerResolutionRequestSchema,
  type CatalogVersionDto,
  type RegisterResolutionRequest,
  type ResolutionDto,
} from '@sigoa/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useReportBusy } from '@/components/common/form-busy-context';
import { ApiError } from '@/lib/api-error';
import { cn } from '@/lib/utils';
import { useRegisterResolution } from '../hooks/use-register-resolution';
import { getResolutionErrorMessage } from '../lib/resolution-error-message';
import {
  REGISTERABLE_RESOLUTION_TYPES,
  formatResolutionType,
  formatVersionLabel,
} from '../lib/resolution-labels';

export interface RegisterResolutionFormProps {
  /** Versiones del catálogo En validación: las únicas a las que se puede vincular (RS 5.3). */
  readonly versions: readonly CatalogVersionDto[];
  readonly versionsLoading: boolean;
  /** El usuario no puede consultar las versiones (sin `catalogo.ver`). */
  readonly versionsDenied: boolean;
  readonly inDialog?: boolean;
  readonly onCancel: () => void;
  readonly onRegistered: (resolution: ResolutionDto) => void;
}

export function RegisterResolutionForm({
  versions,
  versionsLoading,
  versionsDenied,
  inDialog = false,
  onCancel,
  onRegistered,
}: RegisterResolutionFormProps) {
  const uid = useId();
  const mutation = useRegisterResolution();
  useReportBusy(mutation.isPending);
  const [formError, setFormError] = useState<string | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    setFocus,
    setValue,
    setError,
    getValues,
    formState: { errors },
  } = useForm<RegisterResolutionRequest>({
    resolver: zodResolver(registerResolutionRequestSchema),
    defaultValues: {
      type: 'EDUCATIONAL_OBJECTIVE',
      number: '',
      issuedOn: '',
      catalogVersionId: versions[0]?.id ?? '',
    },
  });

  useEffect(() => {
    setFocus('number');
  }, [setFocus]);

  // Con una sola versión En validación (lo habitual) se preselecciona.
  useEffect(() => {
    if (versions.length === 1 && !getValues('catalogVersionId')) {
      setValue('catalogVersionId', versions[0]?.id ?? '');
    }
  }, [versions, getValues, setValue]);

  useEffect(() => {
    if (formError) {
      alertRef.current?.focus();
    }
  }, [formError]);

  async function submit(values: RegisterResolutionRequest) {
    setFormError(null);
    try {
      const resolution = await mutation.mutateAsync(values);
      onRegistered(resolution);
    } catch (error) {
      if (error instanceof ApiError && Array.isArray(error.details)) {
        for (const detail of error.details) {
          if (
            typeof detail === 'object' &&
            detail !== null &&
            'path' in detail &&
            'message' in detail &&
            typeof detail.path === 'string' &&
            typeof detail.message === 'string'
          ) {
            const path = detail.path.startsWith('body.')
              ? detail.path.slice('body.'.length)
              : detail.path;
            if (
              path === 'number' ||
              path === 'catalogVersionId' ||
              path === 'issuedOn' ||
              path === 'type'
            ) {
              setError(path, { type: 'server', message: detail.message });
            }
          }
        }
      }
      setFormError(getResolutionErrorMessage(error));
    }
  }

  const noVersions = !versionsLoading && !versionsDenied && versions.length === 0;
  const blocked = versionsLoading || versionsDenied || noVersions;
  const typeId = `${uid}-type`;
  const numberId = `${uid}-number`;
  const dateId = `${uid}-date`;
  const versionId = `${uid}-version`;
  const versionHelpId = `${uid}-version-help`;

  const versionHelp = versionsDenied
    ? 'No tienes permiso para consultar las versiones del catálogo.'
    : noVersions
      ? 'No hay una versión del catálogo en validación. Envía una versión a validación antes de registrar su resolución.'
      : null;

  return (
    <form
      onSubmit={handleSubmit(submit)}
      noValidate
      aria-label="Registrar resolución"
      className={cn(
        'space-y-4',
        !inDialog && 'rounded-lg border border-border bg-card p-4 text-card-foreground sm:p-6',
      )}
    >
      {!inDialog && (
        <h2 className="text-base font-semibold text-foreground">Registrar resolución</h2>
      )}

      {formError && (
        <div ref={alertRef} tabIndex={-1} className="outline-none focus-visible:outline-2">
          <Alert variant="danger">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={typeId}>Tipo</Label>
          <Select id={typeId} aria-invalid={!!errors.type} {...register('type')}>
            {REGISTERABLE_RESOLUTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatResolutionType(type)}
              </option>
            ))}
          </Select>
          {errors.type && (
            <p role="alert" className="text-xs text-destructive">
              {errors.type.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={numberId}>Número de resolución</Label>
          <Input
            id={numberId}
            autoComplete="off"
            aria-invalid={!!errors.number}
            aria-describedby={errors.number ? `${numberId}-error` : undefined}
            className={cn(errors.number && 'border-destructive focus-visible:ring-destructive')}
            {...register('number')}
          />
          {errors.number && (
            <p id={`${numberId}-error`} role="alert" className="text-xs text-destructive">
              {errors.number.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={dateId}>Fecha de la resolución</Label>
          <Input
            id={dateId}
            type="date"
            aria-invalid={!!errors.issuedOn}
            aria-describedby={errors.issuedOn ? `${dateId}-error` : undefined}
            className={cn(errors.issuedOn && 'border-destructive focus-visible:ring-destructive')}
            {...register('issuedOn')}
          />
          {errors.issuedOn && (
            <p id={`${dateId}-error`} role="alert" className="text-xs text-destructive">
              {errors.issuedOn.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={versionId}>Versión del catálogo</Label>
          <Select
            id={versionId}
            disabled={blocked}
            aria-invalid={!!errors.catalogVersionId}
            aria-describedby={
              [
                versionHelp ? versionHelpId : null,
                errors.catalogVersionId ? `${versionId}-error` : null,
              ]
                .filter(Boolean)
                .join(' ') || undefined
            }
            className={cn(
              errors.catalogVersionId && 'border-destructive focus-visible:ring-destructive',
            )}
            {...register('catalogVersionId')}
          >
            <option value="">
              {versionsLoading ? 'Cargando versiones…' : 'Selecciona una versión'}
            </option>
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {formatVersionLabel(version.number)} (En validación)
              </option>
            ))}
          </Select>
          {versionHelp && (
            <p id={versionHelpId} className="text-xs text-muted-foreground">
              {versionHelp}
            </p>
          )}
          {errors.catalogVersionId && (
            <p id={`${versionId}-error`} role="alert" className="text-xs text-destructive">
              {errors.catalogVersionId.message ||
                'Selecciona la versión del catálogo que aprueba la resolución.'}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={blocked || mutation.isPending}>
          {mutation.isPending ? 'Registrando…' : 'Registrar resolución'}
        </Button>
      </div>
    </form>
  );
}
