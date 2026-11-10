import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createSemesterRequestSchema,
  type CreateSemesterRequest,
  type SemesterDto,
} from '@sigoa/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Can } from '@/components/common/can';
import { usePermission } from '@/hooks/use-permission';
import { cn } from '@/lib/utils';
import { useCreateSemester } from '../hooks/use-create-semester';
import {
  extractSemesterConflictType,
  getSemesterErrorMessage,
} from '../lib/semester-error-message';

export interface SemesterFormProps {
  onSuccess?: (created: SemesterDto) => void;
}

export function SemesterForm({ onSuccess }: SemesterFormProps) {
  const { allowed: canEdit } = usePermission('parametro.editar', 'GLOBAL');
  const createMutation = useCreateSemester();

  const [notice, setNotice] = useState<{
    type: 'success' | 'danger';
    title: string;
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setError,
    setFocus,
  } = useForm<CreateSemesterRequest>({
    resolver: zodResolver(createSemesterRequestSchema),
    defaultValues: {
      code: '',
      startDate: '',
      endDate: '',
    },
  });

  if (!canEdit) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
        <p className="text-sm text-muted-foreground">
          Solo lectura: no tienes permiso para registrar semestres.
        </p>
      </div>
    );
  }

  const onSubmit = async (values: CreateSemesterRequest) => {
    setNotice(null);

    try {
      const created = await createMutation.mutateAsync(values);
      setNotice({
        type: 'success',
        title: 'Registro exitoso',
        message: 'Semestre registrado exitosamente.',
      });
      reset();
      onSuccess?.(created);
    } catch (err: unknown) {
      const conflictType = extractSemesterConflictType(err);
      if (conflictType === 'code') {
        const message = getSemesterErrorMessage(err);
        setError('code', { message });
        setFocus('code');
        return;
      }

      if (conflictType === 'overlap') {
        setNotice({
          type: 'danger',
          title: 'Conflicto de superposición',
          message: getSemesterErrorMessage(err),
        });
        return;
      }

      setNotice({
        type: 'danger',
        title: 'Error al registrar el semestre',
        message: getSemesterErrorMessage(err),
      });
    }
  };

  return (
    <Can permission="parametro.editar" scope="GLOBAL">
      <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Registrar nuevo semestre
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ingresa el código oficial y las fechas de vigencia del semestre académico.
        </p>

        {notice && (
          <div role={notice.type === 'success' ? 'status' : 'alert'} className="mt-4">
            <Alert variant={notice.type === 'success' ? 'success' : 'danger'}>
              <AlertTitle>{notice.title}</AlertTitle>
              <AlertDescription>{notice.message}</AlertDescription>
            </Alert>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="semester-code">Código</Label>
              <Input
                id="semester-code"
                placeholder="2027-I"
                aria-describedby="semester-code-help semester-code-error"
                aria-invalid={!!errors.code}
                className={cn(errors.code && 'border-destructive focus-visible:ring-destructive')}
                {...register('code')}
              />
              <p id="semester-code-help" className="text-xs text-muted-foreground">
                Formato AAAA-I o AAAA-II, por ejemplo 2027-I
              </p>
              {errors.code && (
                <p id="semester-code-error" role="alert" className="text-xs text-destructive">
                  {errors.code.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="semester-start-date">Fecha de inicio</Label>
              <Input
                id="semester-start-date"
                type="date"
                aria-describedby="semester-start-date-error"
                aria-invalid={!!errors.startDate}
                className={cn(
                  errors.startDate && 'border-destructive focus-visible:ring-destructive',
                )}
                {...register('startDate')}
              />
              {errors.startDate && (
                <p id="semester-start-date-error" role="alert" className="text-xs text-destructive">
                  {errors.startDate.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="semester-end-date">Fecha de fin</Label>
              <Input
                id="semester-end-date"
                type="date"
                aria-describedby="semester-end-date-error"
                aria-invalid={!!errors.endDate}
                className={cn(
                  errors.endDate && 'border-destructive focus-visible:ring-destructive',
                )}
                {...register('endDate')}
              />
              {errors.endDate && (
                <p id="semester-end-date-error" role="alert" className="text-xs text-destructive">
                  {errors.endDate.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Registrando...' : 'Registrar semestre'}
            </Button>
          </div>
        </form>
      </div>
    </Can>
  );
}
