import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ROLE_NAME_MIN_LENGTH,
  ROLE_NAME_MAX_LENGTH,
  ROLE_DESCRIPTION_MAX_LENGTH,
  type RoleDto,
  type CreateRoleRequest,
  type UpdateRoleRequest,
} from '@sigoa/shared';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Textarea } from '@/components/ui/textarea.js';
import { Label } from '@/components/ui/label.js';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.js';
import { useCreateRole, useUpdateRole } from '../hooks/index.js';
import { getRoleErrorMessage, isRoleNameConflict } from '../lib/role-error-message.js';

export const roleFormSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre de rol es requerido')
    .refine((val) => val.trim().length >= ROLE_NAME_MIN_LENGTH, {
      message: `El nombre de rol debe tener al menos ${ROLE_NAME_MIN_LENGTH} caracteres`,
    })
    .refine((val) => val.trim().length <= ROLE_NAME_MAX_LENGTH, {
      message: `El nombre de rol no puede exceder ${ROLE_NAME_MAX_LENGTH} caracteres`,
    }),
  description: z.string().refine((val) => !val || val.length <= ROLE_DESCRIPTION_MAX_LENGTH, {
    message: `La descripción no puede exceder ${ROLE_DESCRIPTION_MAX_LENGTH} caracteres`,
  }),
});

export type RoleFormData = z.infer<typeof roleFormSchema>;

export interface RoleFormCreateProps {
  mode: 'create';
  initialRole?: never;
  onSuccess?: (role: RoleDto) => void;
  onCancel?: () => void;
}

export interface RoleFormEditProps {
  mode: 'edit';
  initialRole: RoleDto;
  onSuccess?: (role: RoleDto) => void;
  onCancel?: () => void;
}

export type RoleFormProps = RoleFormCreateProps | RoleFormEditProps;

export function RoleForm({ mode, initialRole, onSuccess, onCancel }: RoleFormProps) {
  const isCreate = mode === 'create';
  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole();

  const [generalError, setGeneralError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<RoleFormData>({
    resolver: zodResolver(roleFormSchema),
    mode: 'onSubmit',
    defaultValues: {
      name: initialRole?.name ?? '',
      description: initialRole?.description ?? '',
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: RoleFormData) => {
    if (isPending) return;
    setGeneralError(null);

    const trimmedName = data.name.trim().replace(/\s+/g, ' ');
    const trimmedDescription = data.description?.trim();
    const formattedDescription = trimmedDescription ? trimmedDescription : null;

    if (isCreate) {
      const payload: CreateRoleRequest = {
        name: trimmedName,
        description: formattedDescription,
        permissions: [],
      };

      createMutation.mutate(payload, {
        onSuccess: (createdRole) => {
          onSuccess?.(createdRole);
        },
        onError: (err) => {
          if (isRoleNameConflict(err)) {
            setError('name', {
              type: 'server',
              message: 'Ya existe un rol con este nombre.',
            });
            setFocus('name');
          } else {
            setGeneralError(getRoleErrorMessage(err));
          }
        },
      });
    } else {
      if (!initialRole) return;

      const payload: UpdateRoleRequest = {
        name: trimmedName,
        description: formattedDescription,
      };

      updateMutation.mutate(
        {
          id: initialRole.id,
          body: payload,
        },
        {
          onSuccess: (updatedRole) => {
            onSuccess?.(updatedRole);
          },
          onError: (err) => {
            if (isRoleNameConflict(err)) {
              setError('name', {
                type: 'server',
                message: 'Ya existe un rol con este nombre.',
              });
              setFocus('name');
            } else {
              setGeneralError(getRoleErrorMessage(err));
            }
          },
        },
      );
    }
  };

  return (
    <form
      aria-label={isCreate ? 'Formulario de creación de rol' : 'Formulario de edición de rol'}
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 max-w-xl"
      noValidate
    >
      {generalError && (
        <Alert variant="danger">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="role-name">
          Nombre del rol <span className="text-destructive">*</span>
        </Label>
        <Input
          id="role-name"
          placeholder="Ej. Docente Evaluador"
          aria-invalid={errors.name ? 'true' : 'false'}
          aria-describedby={errors.name ? 'role-name-error' : undefined}
          disabled={isPending}
          {...register('name')}
        />
        {errors.name && (
          <p id="role-name-error" className="text-destructive text-caption" role="alert">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="role-description">Descripción (opcional)</Label>
        <Textarea
          id="role-description"
          placeholder="Describe la función o alcance de este rol..."
          rows={3}
          aria-invalid={errors.description ? 'true' : 'false'}
          aria-describedby={errors.description ? 'role-description-error' : undefined}
          disabled={isPending}
          {...register('description')}
        />
        {errors.description && (
          <p id="role-description-error" className="text-destructive text-caption" role="alert">
            {errors.description.message}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button
          type="submit"
          disabled={isPending || isSubmitting}
          aria-busy={isPending || isSubmitting}
        >
          {isPending ? 'Guardando…' : 'Guardar'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
