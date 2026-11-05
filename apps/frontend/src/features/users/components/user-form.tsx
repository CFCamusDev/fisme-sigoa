import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { z } from 'zod';
import {
  createUserRequestSchema,
  type CreateUserRequest,
  type UpdateUserRequest,
  type UserDto,
} from '@sigoa/shared';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useCreateUser, useRoles, useUpdateUser } from '../hooks';
import { extractUserConflictField, getUserErrorMessage } from '../lib/user-error-message';

const editFormSchema = z.object({
  names: z.string().min(1, 'El nombre es obligatorio'),
  firstSurname: z.string().min(1, 'El primer apellido es obligatorio'),
  secondSurname: z.string().optional().nullable(),
  email: z.string().email('El correo no es válido'),
  dni: z.string().optional().nullable(),
});

type EditFormData = z.infer<typeof editFormSchema>;

export interface UserFormCreateProps {
  mode: 'create';
  initialUser?: never;
  onSuccess?: (createdUser: UserDto) => void;
}

export interface UserFormEditProps {
  mode: 'edit';
  initialUser: UserDto;
  onSuccess?: (updatedUser: UserDto) => void;
}

export type UserFormProps = UserFormCreateProps | UserFormEditProps;

export function UserForm({ mode, initialUser, onSuccess }: UserFormProps) {
  const isCreate = mode === 'create';
  const rolesQuery = useRoles();
  const roles = rolesQuery.data?.items ?? [];

  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser(initialUser?.id ?? '');

  const [createdResult, setCreatedResult] = useState<UserDto | null>(null);
  const [updatedSuccess, setUpdatedSuccess] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Formulario en modo crear
  const createForm = useForm<CreateUserRequest>({
    resolver: zodResolver(createUserRequestSchema),
    mode: 'onSubmit',
    defaultValues: {
      names: '',
      firstSurname: '',
      secondSurname: '',
      email: '',
      dni: '',
      roleIds: [],
    },
  });

  const selectedRoleIds = useWatch({
    control: createForm.control,
    name: 'roleIds',
    defaultValue: [],
  });

  // Formulario en modo editar
  const editForm = useForm<EditFormData>({
    resolver: zodResolver(editFormSchema),
    mode: 'onSubmit',
    defaultValues: {
      names: initialUser?.names ?? '',
      firstSurname: initialUser?.firstSurname ?? '',
      secondSurname: initialUser?.secondSurname ?? '',
      email: initialUser?.email ?? '',
      dni: initialUser?.dni ?? '',
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Manejo de submit en modo creación
  const handleCreateSubmit = (values: CreateUserRequest) => {
    setGeneralError(null);
    const payload: CreateUserRequest = {
      ...values,
      secondSurname: values.secondSurname?.trim() ? values.secondSurname.trim() : null,
    };
    createMutation.mutate(payload, {
      onSuccess: (data) => {
        setCreatedResult(data);
        onSuccess?.(data);
      },
      onError: (err) => {
        const conflictField = extractUserConflictField(err);
        if (conflictField === 'email') {
          createForm.setError('email', {
            message: 'Ya existe otro usuario con este correo electrónico.',
          });
          createForm.setFocus('email');
        } else if (conflictField === 'dni') {
          createForm.setError('dni', {
            message: 'Ya existe otro usuario con este DNI registrado.',
          });
          createForm.setFocus('dni');
        } else {
          setGeneralError(getUserErrorMessage(err));
        }
      },
    });
  };

  // Manejo de submit en modo edición
  const handleEditSubmit = (values: EditFormData) => {
    setGeneralError(null);
    if (!initialUser) return;

    const dirtyPayload: Partial<UpdateUserRequest> = {};
    if (values.names !== initialUser.names) dirtyPayload.names = values.names;
    if (values.firstSurname !== initialUser.firstSurname)
      dirtyPayload.firstSurname = values.firstSurname;
    if ((values.secondSurname || null) !== (initialUser.secondSurname || null)) {
      dirtyPayload.secondSurname = values.secondSurname ? values.secondSurname : null;
    }
    if (values.email !== initialUser.email) dirtyPayload.email = values.email;
    if (values.dni && values.dni !== (initialUser.dni || undefined)) {
      dirtyPayload.dni = values.dni;
    }

    // Si no hubo campos modificados
    if (Object.keys(dirtyPayload).length === 0) {
      setUpdatedSuccess(true);
      return;
    }

    updateMutation.mutate(dirtyPayload as UpdateUserRequest, {
      onSuccess: (data) => {
        setUpdatedSuccess(true);
        onSuccess?.(data);
      },
      onError: (err) => {
        const conflictField = extractUserConflictField(err);
        if (conflictField === 'email') {
          editForm.setError('email', {
            message: 'Ya existe otro usuario con este correo electrónico.',
          });
          editForm.setFocus('email');
        } else if (conflictField === 'dni') {
          editForm.setError('dni', {
            message: 'Ya existe otro usuario con este DNI registrado.',
          });
          editForm.setFocus('dni');
        } else {
          setGeneralError(getUserErrorMessage(err));
        }
      },
    });
  };

  // Estado de éxito al crear
  if (isCreate && createdResult) {
    return (
      <div className="space-y-6">
        <Alert variant="success">
          <AlertTitle>Usuario creado exitosamente</AlertTitle>
          <AlertDescription>
            Se envió un correo de activación a{' '}
            <strong className="font-semibold">{createdResult.email}</strong> para que pueda definir
            su contraseña.
          </AlertDescription>
        </Alert>

        <div className="flex items-center gap-4">
          <Button
            type="button"
            onClick={() => {
              setCreatedResult(null);
              createForm.reset();
            }}
          >
            Crear otro usuario
          </Button>
          <Link to="/usuarios" className={cn(buttonVariants({ variant: 'outline' }))}>
            Volver a la lista
          </Link>
        </div>
      </div>
    );
  }

  // Estado de éxito al editar
  if (!isCreate && updatedSuccess) {
    return (
      <div className="space-y-6">
        <Alert variant="success">
          <AlertTitle>Cambios guardados</AlertTitle>
          <AlertDescription>
            Los datos del usuario han sido actualizados correctamente en el sistema.
          </AlertDescription>
        </Alert>

        <div>
          <Link to="/usuarios" className={cn(buttonVariants({ variant: 'default' }))}>
            Volver a la lista
          </Link>
        </div>
      </div>
    );
  }

  if (isCreate) {
    const {
      register,
      handleSubmit,
      setValue,
      formState: { errors },
    } = createForm;

    const handleRoleToggle = (roleId: string) => {
      const current = new Set(selectedRoleIds);
      if (current.has(roleId)) {
        current.delete(roleId);
      } else {
        current.add(roleId);
      }
      setValue('roleIds', Array.from(current), { shouldValidate: true });
    };

    return (
      <form onSubmit={handleSubmit(handleCreateSubmit)} className="space-y-6" noValidate>
        {generalError && (
          <Alert variant="danger">
            <AlertTitle>Error al crear usuario</AlertTitle>
            <AlertDescription>{generalError}</AlertDescription>
          </Alert>
        )}

        {rolesQuery.isError && (
          <Alert variant="danger">
            <AlertTitle>Error al cargar catálogo de roles</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>No se pudieron cargar los roles necesarios para el registro.</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => rolesQuery.refetch()}
              >
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Nombres */}
          <div className="space-y-1.5">
            <Label htmlFor="user-names">
              Nombres{' '}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
              <span className="sr-only">obligatorio</span>
            </Label>
            <Input
              id="user-names"
              disabled={isPending}
              aria-invalid={errors.names ? 'true' : 'false'}
              aria-describedby={errors.names ? 'user-names-error' : undefined}
              {...register('names')}
            />
            {errors.names && (
              <p id="user-names-error" className="text-meta text-destructive" role="alert">
                {errors.names.message}
              </p>
            )}
          </div>

          {/* Primer apellido */}
          <div className="space-y-1.5">
            <Label htmlFor="user-first-surname">
              Primer apellido{' '}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
              <span className="sr-only">obligatorio</span>
            </Label>
            <Input
              id="user-first-surname"
              disabled={isPending}
              aria-invalid={errors.firstSurname ? 'true' : 'false'}
              aria-describedby={errors.firstSurname ? 'user-first-surname-error' : undefined}
              {...register('firstSurname')}
            />
            {errors.firstSurname && (
              <p id="user-first-surname-error" className="text-meta text-destructive" role="alert">
                {errors.firstSurname.message}
              </p>
            )}
          </div>

          {/* Segundo apellido */}
          <div className="space-y-1.5">
            <Label htmlFor="user-second-surname">Segundo apellido</Label>
            <Input
              id="user-second-surname"
              disabled={isPending}
              aria-invalid={errors.secondSurname ? 'true' : 'false'}
              aria-describedby={errors.secondSurname ? 'user-second-surname-error' : undefined}
              {...register('secondSurname')}
            />
            {errors.secondSurname && (
              <p id="user-second-surname-error" className="text-meta text-destructive" role="alert">
                {errors.secondSurname.message}
              </p>
            )}
          </div>

          {/* Correo electrónico */}
          <div className="space-y-1.5">
            <Label htmlFor="user-email">
              Correo electrónico{' '}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
              <span className="sr-only">obligatorio</span>
            </Label>
            <Input
              id="user-email"
              type="email"
              disabled={isPending}
              aria-invalid={errors.email ? 'true' : 'false'}
              aria-describedby={errors.email ? 'user-email-error' : undefined}
              {...register('email')}
            />
            {errors.email && (
              <p id="user-email-error" className="text-meta text-destructive" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* DNI */}
          <div className="space-y-1.5">
            <Label htmlFor="user-dni">
              DNI{' '}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
              <span className="sr-only">obligatorio</span>
            </Label>
            <Input
              id="user-dni"
              inputMode="numeric"
              maxLength={8}
              disabled={isPending}
              aria-invalid={errors.dni ? 'true' : 'false'}
              aria-describedby={errors.dni ? 'user-dni-error' : undefined}
              {...register('dni')}
            />
            {errors.dni && (
              <p id="user-dni-error" className="text-meta text-destructive" role="alert">
                {errors.dni.message}
              </p>
            )}
          </div>
        </div>

        {/* Roles */}
        <fieldset className="space-y-3">
          <legend className="text-label font-medium text-foreground">
            Roles asignados{' '}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
            <span className="sr-only">debe seleccionar al menos un rol</span>
          </legend>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {roles.map((role) => {
              const isChecked = selectedRoleIds.includes(role.id);
              return (
                <label
                  key={role.id}
                  className="surface flex items-center gap-3 rounded-md border border-input p-3 hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={isChecked}
                    onChange={() => handleRoleToggle(role.id)}
                    disabled={isPending || rolesQuery.isError}
                    aria-invalid={errors.roleIds ? 'true' : 'false'}
                  />
                  <div className="flex flex-col">
                    <span className="text-label font-medium text-foreground">{role.name}</span>
                    {role.description && (
                      <span className="text-meta text-muted-foreground">{role.description}</span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          {errors.roleIds && (
            <p id="user-roles-error" className="text-meta text-destructive" role="alert">
              {errors.roleIds.message}
            </p>
          )}
        </fieldset>

        {/* Botones de acción */}
        <div className="flex items-center gap-4 pt-4 border-t border-border">
          <Button type="submit" disabled={isPending || rolesQuery.isError}>
            {isPending ? 'Creando usuario...' : 'Crear usuario'}
          </Button>
          <Link to="/usuarios" className={cn(buttonVariants({ variant: 'outline' }))}>
            Cancelar
          </Link>
        </div>
      </form>
    );
  }

  // Render en modo edición
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = editForm;

  const rolesMap = new Map<string, string>();
  for (const role of roles) {
    rolesMap.set(role.id, role.name);
  }
  const assignedRoleNames =
    initialUser?.roleIds
      ?.map((id) => rolesMap.get(id))
      .filter(Boolean)
      .join(', ') || '—';

  return (
    <form onSubmit={handleSubmit(handleEditSubmit)} className="space-y-6" noValidate>
      {generalError && (
        <Alert variant="danger">
          <AlertTitle>Error al guardar cambios</AlertTitle>
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Nombres */}
        <div className="space-y-1.5">
          <Label htmlFor="edit-user-names">
            Nombres{' '}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
            <span className="sr-only">obligatorio</span>
          </Label>
          <Input
            id="edit-user-names"
            disabled={isPending}
            aria-invalid={errors.names ? 'true' : 'false'}
            aria-describedby={errors.names ? 'edit-user-names-error' : undefined}
            {...register('names')}
          />
          {errors.names && (
            <p id="edit-user-names-error" className="text-meta text-destructive" role="alert">
              {errors.names.message}
            </p>
          )}
        </div>

        {/* Primer apellido */}
        <div className="space-y-1.5">
          <Label htmlFor="edit-user-first-surname">
            Primer apellido{' '}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
            <span className="sr-only">obligatorio</span>
          </Label>
          <Input
            id="edit-user-first-surname"
            disabled={isPending}
            aria-invalid={errors.firstSurname ? 'true' : 'false'}
            aria-describedby={errors.firstSurname ? 'edit-user-first-surname-error' : undefined}
            {...register('firstSurname')}
          />
          {errors.firstSurname && (
            <p
              id="edit-user-first-surname-error"
              className="text-meta text-destructive"
              role="alert"
            >
              {errors.firstSurname.message}
            </p>
          )}
        </div>

        {/* Segundo apellido */}
        <div className="space-y-1.5">
          <Label htmlFor="edit-user-second-surname">Segundo apellido</Label>
          <Input
            id="edit-user-second-surname"
            disabled={isPending}
            aria-invalid={errors.secondSurname ? 'true' : 'false'}
            aria-describedby={errors.secondSurname ? 'edit-user-second-surname-error' : undefined}
            {...register('secondSurname')}
          />
          {errors.secondSurname && (
            <p
              id="edit-user-second-surname-error"
              className="text-meta text-destructive"
              role="alert"
            >
              {errors.secondSurname.message}
            </p>
          )}
        </div>

        {/* Correo electrónico */}
        <div className="space-y-1.5">
          <Label htmlFor="edit-user-email">
            Correo electrónico{' '}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
            <span className="sr-only">obligatorio</span>
          </Label>
          <Input
            id="edit-user-email"
            type="email"
            disabled={isPending}
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby={errors.email ? 'edit-user-email-error' : undefined}
            {...register('email')}
          />
          {errors.email && (
            <p id="edit-user-email-error" className="text-meta text-destructive" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* DNI */}
        <div className="space-y-1.5">
          <Label htmlFor="edit-user-dni">DNI</Label>
          <Input
            id="edit-user-dni"
            inputMode="numeric"
            maxLength={8}
            placeholder={initialUser?.dni ? undefined : 'Sin DNI registrado'}
            disabled={isPending}
            aria-invalid={errors.dni ? 'true' : 'false'}
            aria-describedby={errors.dni ? 'edit-user-dni-error' : undefined}
            {...register('dni')}
          />
          {errors.dni && (
            <p id="edit-user-dni-error" className="text-meta text-destructive" role="alert">
              {errors.dni.message}
            </p>
          )}
        </div>
      </div>

      {/* Roles de solo lectura */}
      <div className="space-y-1.5 pt-2">
        <span className="text-label font-medium text-foreground block">
          Roles asignados (solo lectura)
        </span>
        <p className="surface rounded-md border border-input p-3 text-body text-foreground">
          {assignedRoleNames}
        </p>
        <p className="text-meta text-muted-foreground">
          Los roles de usuario se asignan y gestionan en su módulo correspondiente.
        </p>
      </div>

      {/* Botones de acción */}
      <div className="flex items-center gap-4 pt-4 border-t border-border">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando cambios...' : 'Guardar cambios'}
        </Button>
        <Link to="/usuarios" className={cn(buttonVariants({ variant: 'outline' }))}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
