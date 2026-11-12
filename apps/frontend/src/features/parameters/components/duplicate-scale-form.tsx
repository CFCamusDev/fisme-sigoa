import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  duplicateResponseScaleRequestSchema,
  type DuplicateResponseScaleRequest,
  type ResponseScaleDto,
} from '@sigoa/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useDuplicateResponseScale } from '../hooks/use-duplicate-response-scale';
import { getResponseScaleErrorMessage } from '../lib/response-scale-error-message';
import { suggestDuplicate } from '../lib/response-scale-labels';

export interface DuplicateScaleFormProps {
  scale: ResponseScaleDto;
  onCancel: () => void;
  onDuplicated: (created: ResponseScaleDto) => void;
}

export function DuplicateScaleForm({ scale, onCancel, onDuplicated }: DuplicateScaleFormProps) {
  const duplicateMutation = useDuplicateResponseScale();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DuplicateResponseScaleRequest>({
    defaultValues: suggestDuplicate(scale),
    resolver: zodResolver(duplicateResponseScaleRequestSchema),
  });

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const onSubmit = async (values: DuplicateResponseScaleRequest) => {
    if (submittingRef.current || duplicateMutation.isPending) {
      return;
    }
    setGeneralError(null);

    submittingRef.current = true;
    try {
      const created = await duplicateMutation.mutateAsync({ id: scale.id, body: values });
      onDuplicated(created);
    } catch (error: unknown) {
      const message = getResponseScaleErrorMessage(error);
      if ((error as { status?: number } | null)?.status === 409) {
        setError('code', { type: 'server', message });
        return;
      }
      setGeneralError(message);
    } finally {
      submittingRef.current = false;
    }
  };

  const codeError = errors.code?.message;
  const nameError = errors.name?.message;
  const idPrefix = `duplicate-${scale.id}`;

  return (
    <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="text-base font-semibold text-foreground focus:outline-none"
      >
        Duplicar escala
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Se copian el tipo y los niveles de «{scale.name}» en una escala nueva que sí puedes editar.
      </p>

      {generalError && (
        <div className="mt-4">
          <Alert variant="danger" role="alert">
            <AlertTitle>No se pudo duplicar la escala</AlertTitle>
            <AlertDescription>{generalError}</AlertDescription>
          </Alert>
        </div>
      )}

      <form
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event);
        }}
        className="mt-4 space-y-4"
        noValidate
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-code`}>Código de la copia</Label>
            <Input
              id={`${idPrefix}-code`}
              type="text"
              autoComplete="off"
              maxLength={60}
              aria-invalid={!!codeError}
              aria-describedby={codeError ? `${idPrefix}-code-error` : undefined}
              className={cn(codeError && 'border-destructive focus-visible:ring-destructive')}
              {...register('code')}
            />
            {codeError && (
              <p id={`${idPrefix}-code-error`} role="alert" className="text-meta text-destructive">
                {codeError}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-name`}>Nombre de la copia</Label>
            <Input
              id={`${idPrefix}-name`}
              type="text"
              maxLength={200}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? `${idPrefix}-name-error` : undefined}
              className={cn(nameError && 'border-destructive focus-visible:ring-destructive')}
              {...register('name')}
            />
            {nameError && (
              <p id={`${idPrefix}-name-error`} role="alert" className="text-meta text-destructive">
                {nameError}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={duplicateMutation.isPending}>
            {duplicateMutation.isPending ? 'Duplicando…' : 'Duplicar escala'}
          </Button>
        </div>
      </form>
    </div>
  );
}
