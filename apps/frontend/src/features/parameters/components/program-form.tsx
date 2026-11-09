import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  programCodeSchema,
  programFacultySchema,
  programNameSchema,
  type ProgramDto,
  type UpdateProgramRequest,
} from '@sigoa/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Can } from '@/components/common/can';
import { usePermission } from '@/hooks/use-permission';
import { cn } from '@/lib/utils';
import { useUpdateProgram } from '../hooks/use-update-program';
import { extractProgramConflictField, getProgramErrorMessage } from '../lib/program-error-message';

const programFormSchema = z.object({
  code: programCodeSchema,
  name: programNameSchema,
  faculty: programFacultySchema,
});

export type ProgramFormData = z.infer<typeof programFormSchema>;

export interface ProgramFormProps {
  program: ProgramDto;
  onSuccess?: (updated: ProgramDto) => void;
}

export function ProgramForm({ program, onSuccess }: ProgramFormProps) {
  const { allowed: canEdit } = usePermission('parametro.editar', 'GLOBAL');
  const updateMutation = useUpdateProgram();

  const [notice, setNotice] = useState<{
    type: 'success' | 'default' | 'danger';
    title: string;
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, dirtyFields },
    reset,
    setError,
    setFocus,
  } = useForm<ProgramFormData>({
    resolver: zodResolver(programFormSchema),
    defaultValues: {
      code: program.code,
      name: program.name,
      faculty: program.faculty,
    },
  });

  const onSubmit = async (values: ProgramFormData) => {
    setNotice(null);

    const changes: UpdateProgramRequest = {};
    if (dirtyFields.code) changes.code = values.code;
    if (dirtyFields.name) changes.name = values.name;
    if (dirtyFields.faculty) changes.faculty = values.faculty;

    if (Object.keys(changes).length === 0) {
      setNotice({
        type: 'default',
        title: 'Sin cambios',
        message: 'No hay cambios por guardar.',
      });
      return;
    }

    try {
      const updated = await updateMutation.mutateAsync(changes);
      reset({
        code: updated.code,
        name: updated.name,
        faculty: updated.faculty,
      });
      setNotice({
        type: 'success',
        title: 'Cambios guardados',
        message: 'Los datos del programa han sido actualizados exitosamente.',
      });
      onSuccess?.(updated);
    } catch (err) {
      const conflictField = extractProgramConflictField(err);
      const msg = getProgramErrorMessage(err);
      if (conflictField === 'code') {
        setError('code', { type: 'manual', message: msg });
        setFocus('code');
      } else {
        setNotice({
          type: 'danger',
          title: 'Error al actualizar',
          message: msg,
        });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {notice && (
        <Alert variant={notice.type}>
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      )}

      {!canEdit && (
        <p className="text-body-sm text-muted-foreground">
          Solo lectura: no tienes permiso para editar los datos del programa.
        </p>
      )}

      <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-xs">
        <div className="space-y-2">
          <Label htmlFor="program-code">Código del programa</Label>
          <Input
            id="program-code"
            {...register('code')}
            readOnly={!canEdit}
            aria-invalid={errors.code ? 'true' : 'false'}
            aria-describedby={errors.code ? 'program-code-error' : undefined}
            className={cn(!canEdit && 'cursor-not-allowed bg-muted')}
          />
          {errors.code && (
            <p
              id="program-code-error"
              role="alert"
              className="text-body-sm font-medium text-destructive"
            >
              {errors.code.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="program-name">Nombre del programa</Label>
          <Input
            id="program-name"
            {...register('name')}
            readOnly={!canEdit}
            aria-invalid={errors.name ? 'true' : 'false'}
            aria-describedby={errors.name ? 'program-name-error' : undefined}
            className={cn(!canEdit && 'cursor-not-allowed bg-muted')}
          />
          {errors.name && (
            <p
              id="program-name-error"
              role="alert"
              className="text-body-sm font-medium text-destructive"
            >
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="program-faculty">Facultad</Label>
          <Input
            id="program-faculty"
            {...register('faculty')}
            readOnly={!canEdit}
            aria-invalid={errors.faculty ? 'true' : 'false'}
            aria-describedby={errors.faculty ? 'program-faculty-error' : undefined}
            className={cn(!canEdit && 'cursor-not-allowed bg-muted')}
          />
          {errors.faculty && (
            <p
              id="program-faculty-error"
              role="alert"
              className="text-body-sm font-medium text-destructive"
            >
              {errors.faculty.message}
            </p>
          )}
        </div>
      </div>

      <Can permission="parametro.editar" scope="GLOBAL">
        <div className="flex justify-end">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Guardando cambios...' : 'Guardar cambios'}
          </Button>
        </div>
      </Can>
    </form>
  );
}
