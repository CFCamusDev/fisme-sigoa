import { useEffect, useId, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert } from 'lucide-react';
import type { StakeholderDto } from '@sigoa/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { ApiError } from '@/lib/api-error';
import { cn } from '@/lib/utils';
import { getStakeholders } from '../api/get-stakeholders';
import { useEditStakeholder } from '../hooks/use-edit-stakeholder';
import { useRegisterStakeholder } from '../hooks/use-register-stakeholder';
import { getStakeholderErrorMessage } from '../lib/stakeholder-error-message';
import {
  buildEditStakeholderPayload,
  getInitialStakeholderFormValues,
  stakeholderFormSchema,
  toRegisterStakeholderPayload,
  type StakeholderFormValues,
} from '../schemas/stakeholder-form';
import { DuplicateStakeholderAlert } from './duplicate-stakeholder-alert';

export interface StakeholderFormProps {
  readonly mode: 'register' | 'edit';
  readonly initialStakeholder?: StakeholderDto;
  readonly onCancel: () => void;
  readonly onSaved: (stakeholder: StakeholderDto, mode: 'register' | 'edit') => void;
  readonly onSelectExisting?: (stakeholder: StakeholderDto) => void;
}

export function StakeholderForm({
  mode,
  initialStakeholder,
  onCancel,
  onSaved,
  onSelectExisting,
}: StakeholderFormProps) {
  const uid = useId();
  const registerMutation = useRegisterStakeholder();
  const editMutation = useEditStakeholder();
  const isPending = registerMutation.isPending || editMutation.isPending;

  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateStakeholder, setDuplicateStakeholder] = useState<StakeholderDto | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    control,
    setFocus,
    reset,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<StakeholderFormValues>({
    resolver: zodResolver(stakeholderFormSchema),
    defaultValues: getInitialStakeholderFormValues(initialStakeholder),
  });

  const kind = useWatch({ control, name: 'kind' });

  useEffect(() => {
    reset(getInitialStakeholderFormValues(initialStakeholder));
  }, [initialStakeholder, mode, reset]);

  useEffect(() => {
    setFocus('fullName');
  }, [setFocus, initialStakeholder?.id, mode]);

  useEffect(() => {
    if (formError) {
      alertRef.current?.focus();
    }
  }, [formError]);

  async function lookupDuplicate(values: StakeholderFormValues) {
    const document = values.kind === 'PERSON' ? values.dni.trim() : values.ruc.trim();
    if (!document) {
      return;
    }
    try {
      const response = await getStakeholders({ document, page: 1, pageSize: 1 });
      const existing = response.items[0] ?? null;
      setDuplicateStakeholder(existing);
    } catch {
      setDuplicateStakeholder(null);
    }
  }

  async function submit(values: StakeholderFormValues) {
    setFormError(null);
    setDuplicateStakeholder(null);

    try {
      if (mode === 'register') {
        const payload = toRegisterStakeholderPayload(values);
        const created = await registerMutation.mutateAsync(payload);
        onSaved(created, 'register');
        return;
      }

      if (!initialStakeholder) {
        return;
      }
      const changes = buildEditStakeholderPayload(values, dirtyFields);
      const updated = await editMutation.mutateAsync({
        id: initialStakeholder.id,
        changes,
      });
      onSaved(updated, 'edit');
    } catch (error) {
      setFormError(getStakeholderErrorMessage(error));
      const apiErr = error as Partial<ApiError> | undefined;
      if (apiErr?.status === 409) {
        await lookupDuplicate(values);
      }
    }
  }

  const isEditUnchanged = mode === 'edit' && !isDirty;
  const submitLabel = isPending
    ? 'Guardando…'
    : isEditUnchanged
      ? 'Sin cambios'
      : mode === 'register'
        ? 'Guardar constituyente'
        : 'Guardar cambios';

  const fieldId = (name: string) => `${uid}-${name}`;
  const errorId = (name: string) => `${uid}-${name}-error`;

  return (
    <form
      onSubmit={handleSubmit(submit)}
      noValidate
      className="space-y-4 rounded-lg border border-border bg-card p-6 text-card-foreground"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">
          {mode === 'register' ? 'Registrar constituyente' : 'Editar constituyente'}
        </h2>
      </div>

      {formError ? (
        <Alert ref={alertRef} variant="danger" tabIndex={-1}>
          <CircleAlert className="size-4" aria-hidden="true" />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      {duplicateStakeholder ? (
        <DuplicateStakeholderAlert
          stakeholder={duplicateStakeholder}
          onEditExisting={onSelectExisting}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={fieldId('kind')}>Tipo</Label>
          <Select
            id={fieldId('kind')}
            disabled={mode === 'edit' || isPending}
            aria-invalid={errors.kind ? 'true' : undefined}
            aria-describedby={errors.kind ? errorId('kind') : undefined}
            {...register('kind')}
          >
            <option value="PERSON">Persona</option>
            <option value="INSTITUTION">Institución</option>
          </Select>
          {errors.kind ? (
            <p id={errorId('kind')} role="alert" className="text-xs text-destructive">
              {errors.kind.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={fieldId('fullName')}>
            {kind === 'PERSON' ? 'Nombres y apellidos' : 'Razón social'}
          </Label>
          <Input
            id={fieldId('fullName')}
            disabled={isPending}
            aria-invalid={errors.fullName ? 'true' : undefined}
            aria-describedby={errors.fullName ? errorId('fullName') : undefined}
            className={cn(errors.fullName && 'border-destructive')}
            {...register('fullName')}
          />
          {errors.fullName ? (
            <p id={errorId('fullName')} role="alert" className="text-xs text-destructive">
              {errors.fullName.message}
            </p>
          ) : null}
        </div>

        {kind === 'PERSON' ? (
          <div className="space-y-1.5">
            <Label htmlFor={fieldId('dni')}>DNI</Label>
            <Input
              id={fieldId('dni')}
              inputMode="numeric"
              maxLength={8}
              disabled={isPending}
              aria-invalid={errors.dni ? 'true' : undefined}
              aria-describedby={errors.dni ? errorId('dni') : undefined}
              className={cn(errors.dni && 'border-destructive')}
              {...register('dni')}
            />
            {errors.dni ? (
              <p id={errorId('dni')} role="alert" className="text-xs text-destructive">
                {errors.dni.message}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor={fieldId('ruc')}>RUC</Label>
            <Input
              id={fieldId('ruc')}
              inputMode="numeric"
              maxLength={11}
              disabled={isPending}
              aria-invalid={errors.ruc ? 'true' : undefined}
              aria-describedby={errors.ruc ? errorId('ruc') : undefined}
              className={cn(errors.ruc && 'border-destructive')}
              {...register('ruc')}
            />
            {errors.ruc ? (
              <p id={errorId('ruc')} role="alert" className="text-xs text-destructive">
                {errors.ruc.message}
              </p>
            ) : null}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor={fieldId('email')}>Correo electrónico</Label>
          <Input
            id={fieldId('email')}
            type="email"
            disabled={isPending}
            aria-invalid={errors.email ? 'true' : undefined}
            aria-describedby={errors.email ? errorId('email') : undefined}
            className={cn(errors.email && 'border-destructive')}
            {...register('email')}
          />
          {errors.email ? (
            <p id={errorId('email')} role="alert" className="text-xs text-destructive">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={fieldId('mobile')}>Celular</Label>
          <Input
            id={fieldId('mobile')}
            inputMode="numeric"
            maxLength={9}
            disabled={isPending}
            aria-invalid={errors.mobile ? 'true' : undefined}
            aria-describedby={errors.mobile ? errorId('mobile') : undefined}
            className={cn(errors.mobile && 'border-destructive')}
            {...register('mobile')}
          />
          {errors.mobile ? (
            <p id={errorId('mobile')} role="alert" className="text-xs text-destructive">
              {errors.mobile.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={fieldId('position')}>Cargo</Label>
          <Input
            id={fieldId('position')}
            disabled={isPending}
            aria-invalid={errors.position ? 'true' : undefined}
            aria-describedby={errors.position ? errorId('position') : undefined}
            {...register('position')}
          />
          {errors.position ? (
            <p id={errorId('position')} role="alert" className="text-xs text-destructive">
              {errors.position.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={fieldId('sector')}>Sector</Label>
          <Input
            id={fieldId('sector')}
            disabled={isPending}
            aria-invalid={errors.sector ? 'true' : undefined}
            aria-describedby={errors.sector ? errorId('sector') : undefined}
            {...register('sector')}
          />
          {errors.sector ? (
            <p id={errorId('sector')} role="alert" className="text-xs text-destructive">
              {errors.sector.message}
            </p>
          ) : null}
        </div>

        {kind === 'PERSON' ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor={fieldId('institution')}>Institución</Label>
              <Input
                id={fieldId('institution')}
                disabled={isPending}
                aria-invalid={errors.institution ? 'true' : undefined}
                aria-describedby={errors.institution ? errorId('institution') : undefined}
                {...register('institution')}
              />
              {errors.institution ? (
                <p id={errorId('institution')} role="alert" className="text-xs text-destructive">
                  {errors.institution.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={fieldId('graduationYear')}>Año de egreso</Label>
              <Input
                id={fieldId('graduationYear')}
                inputMode="numeric"
                disabled={isPending}
                aria-invalid={errors.graduationYear ? 'true' : undefined}
                aria-describedby={errors.graduationYear ? errorId('graduationYear') : undefined}
                className={cn(errors.graduationYear && 'border-destructive')}
                {...register('graduationYear')}
              />
              {errors.graduationYear ? (
                <p id={errorId('graduationYear')} role="alert" className="text-xs text-destructive">
                  {errors.graduationYear.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={fieldId('cycle')}>Ciclo</Label>
              <Input
                id={fieldId('cycle')}
                disabled={isPending}
                aria-invalid={errors.cycle ? 'true' : undefined}
                aria-describedby={errors.cycle ? errorId('cycle') : undefined}
                {...register('cycle')}
              />
              {errors.cycle ? (
                <p id={errorId('cycle')} role="alert" className="text-xs text-destructive">
                  {errors.cycle.message}
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending || isEditUnchanged}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
