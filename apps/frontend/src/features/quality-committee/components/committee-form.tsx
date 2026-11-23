import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Plus, Trash2, Unlink, UserCheck } from 'lucide-react';
import {
  COMMITTEE_MEMBERS_MAX,
  registerQualityCommitteeRequestSchema,
  replaceCommitteeMembersRequestSchema,
  type CommitteeMemberPositionDto,
  type QualityCommitteeDto,
  type RegisterQualityCommitteeRequest,
  type ReplaceCommitteeMembersRequest,
} from '@sigoa/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getFieldErrors } from '@/lib/validation-errors';
import { formatCommitteePeriod } from '../lib/committee-dates';

interface MemberFormRow {
  fullName: string;
  degree: string;
  position: CommitteeMemberPositionDto;
  userId: string | null;
  linkedUserName: string | null;
  userEmail: string;
}

interface CommitteeFormValues {
  periodStart: string;
  periodEnd: string;
  members: MemberFormRow[];
}

export interface CommitteeFormProps {
  readonly mode: 'create' | 'edit';
  readonly initialCommittee?: QualityCommitteeDto | null;
  readonly isSubmitting: boolean;
  readonly serverError: string | null;
  readonly serverErrorDetail?: unknown;
  readonly onCancel: () => void;
  readonly onSubmitCreate: (payload: RegisterQualityCommitteeRequest) => Promise<void> | void;
  readonly onSubmitEdit: (
    committeeId: string,
    payload: ReplaceCommitteeMembersRequest,
  ) => Promise<void> | void;
}

function buildDefaultValues(
  mode: 'create' | 'edit',
  committee?: QualityCommitteeDto | null,
): CommitteeFormValues {
  if (mode === 'edit' && committee) {
    return {
      periodStart: committee.periodStart,
      periodEnd: committee.periodEnd,
      members: committee.members.map((member) => ({
        fullName: member.fullName,
        degree: member.degree,
        position: member.position,
        userId: member.userId,
        linkedUserName: member.linkedUserName,
        userEmail: '',
      })),
    };
  }

  return {
    periodStart: '',
    periodEnd: '',
    members: [
      {
        fullName: '',
        degree: '',
        position: 'PRESIDENT',
        userId: null,
        linkedUserName: null,
        userEmail: '',
      },
    ],
  };
}

export function CommitteeForm({
  mode,
  initialCommittee,
  isSubmitting,
  serverError,
  serverErrorDetail,
  onCancel,
  onSubmitCreate,
  onSubmitEdit,
}: CommitteeFormProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationFieldErrors, setValidationFieldErrors] = useState<Record<string, string>>({});

  const { register, control, handleSubmit, setValue } = useForm<CommitteeFormValues>({
    defaultValues: buildDefaultValues(mode, initialCommittee),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'members',
  });

  const watchedMembers = useWatch({ control, name: 'members' }) ?? [];

  const onFormSubmit = handleSubmit(async (values) => {
    setValidationError(null);
    setValidationFieldErrors({});

    const normalizedMembers = values.members.map((row) => ({
      fullName: row.fullName.trim(),
      degree: row.degree.trim(),
      position: row.position,
      ...(row.userId
        ? { userId: row.userId }
        : row.userEmail.trim().length > 0
          ? { userEmail: row.userEmail.trim() }
          : {}),
    }));

    if (mode === 'create') {
      const parsed = registerQualityCommitteeRequestSchema.safeParse({
        periodStart: values.periodStart,
        periodEnd: values.periodEnd,
        members: normalizedMembers,
      });

      if (!parsed.success) {
        const mapped = getFieldErrors(parsed.error);
        setValidationFieldErrors(mapped);
        setValidationError(
          Object.keys(mapped).length > 0
            ? 'Revisa los campos marcados en el formulario.'
            : (parsed.error.issues[0]?.message ??
                'Revisa los datos ingresados del Comité de Calidad.'),
        );
        return;
      }

      await onSubmitCreate(parsed.data);
      return;
    }

    if (!initialCommittee) {
      return;
    }

    const parsed = replaceCommitteeMembersRequestSchema.safeParse({
      members: normalizedMembers,
    });

    if (!parsed.success) {
      const mapped = getFieldErrors(parsed.error);
      setValidationFieldErrors(mapped);
      setValidationError(
        Object.keys(mapped).length > 0
          ? 'Revisa los campos marcados en el formulario.'
          : (parsed.error.issues[0]?.message ??
              'Revisa los miembros ingresados del Comité de Calidad.'),
      );
      return;
    }

    await onSubmitEdit(initialCommittee.id, parsed.data);
  });

  const activeError = validationError ?? serverError;
  const fieldErrors =
    Object.keys(validationFieldErrors).length > 0
      ? validationFieldErrors
      : getFieldErrors(serverErrorDetail);

  return (
    <section
      aria-labelledby="committee-form-heading"
      className="space-y-6 rounded-lg border border-border bg-card p-6 text-card-foreground"
    >
      <div className="space-y-1">
        <h2 id="committee-form-heading" className="text-lg font-semibold text-foreground">
          {mode === 'create' ? 'Registrar Comité de Calidad' : 'Editar miembros del Comité'}
        </h2>
        {mode === 'edit' && initialCommittee ? (
          <p className="text-sm text-muted-foreground">
            Periodo (solo lectura):{' '}
            {formatCommitteePeriod(initialCommittee.periodStart, initialCommittee.periodEnd)}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Define las fechas del periodo y registra al menos un Presidente. Un periodo equivocado
            se corrige registrando un Comité nuevo.
          </p>
        )}
      </div>

      {activeError && (
        <Alert variant="danger">
          <AlertDescription>{activeError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={onFormSubmit} className="space-y-6" noValidate>
        {mode === 'create' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="committee-period-start">Fecha de inicio</Label>
              <Input
                id="committee-period-start"
                type="date"
                required
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.periodStart)}
                aria-describedby={
                  fieldErrors.periodStart ? 'committee-period-start-error' : undefined
                }
                {...register('periodStart')}
              />
              {fieldErrors.periodStart && (
                <p
                  id="committee-period-start-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {fieldErrors.periodStart}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="committee-period-end">Fecha de fin</Label>
              <Input
                id="committee-period-end"
                type="date"
                required
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.periodEnd)}
                aria-describedby={fieldErrors.periodEnd ? 'committee-period-end-error' : undefined}
                {...register('periodEnd')}
              />
              {fieldErrors.periodEnd && (
                <p
                  id="committee-period-end-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {fieldErrors.periodEnd}
                </p>
              )}
            </div>
          </div>
        )}

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground">
            Miembros del Comité ({fields.length} / {COMMITTEE_MEMBERS_MAX})
          </legend>

          <div className="space-y-4">
            {fields.map((field, index) => {
              const currentRow = watchedMembers[index];
              const linkedUserId = currentRow?.userId ?? null;
              const linkedUserName = currentRow?.linkedUserName ?? null;
              const rowNumber = index + 1;
              const fullNameError = fieldErrors[`members.${index}.fullName`];
              const degreeError = fieldErrors[`members.${index}.degree`];
              const userEmailError =
                fieldErrors[`members.${index}.userEmail`] ?? fieldErrors[`members.${index}.userId`];
              const membersError = fieldErrors.members;

              return (
                <div
                  key={field.id}
                  role="group"
                  aria-label={`Miembro ${rowNumber}`}
                  className="space-y-3 rounded-md border border-border bg-background p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Miembro {rowNumber}</span>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isSubmitting}
                        onClick={() => remove(index)}
                        aria-label={`Quitar miembro ${rowNumber}`}
                      >
                        <Trash2 className="mr-1.5 size-4" aria-hidden="true" />
                        Quitar
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`member-${index}-fullName`}>Nombre completo</Label>
                      <Input
                        id={`member-${index}-fullName`}
                        type="text"
                        placeholder="Ej. Ana Torres Quispe"
                        disabled={isSubmitting}
                        aria-invalid={Boolean(fullNameError)}
                        aria-describedby={
                          fullNameError ? `member-${index}-fullName-error` : undefined
                        }
                        {...register(`members.${index}.fullName`)}
                      />
                      {fullNameError && (
                        <p
                          id={`member-${index}-fullName-error`}
                          role="alert"
                          className="text-xs text-destructive"
                        >
                          {fullNameError}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`member-${index}-degree`}>Grado académico</Label>
                      <Input
                        id={`member-${index}-degree`}
                        type="text"
                        placeholder="Ej. Dr., Mg., Ing."
                        disabled={isSubmitting}
                        aria-invalid={Boolean(degreeError)}
                        aria-describedby={degreeError ? `member-${index}-degree-error` : undefined}
                        {...register(`members.${index}.degree`)}
                      />
                      {degreeError && (
                        <p
                          id={`member-${index}-degree-error`}
                          role="alert"
                          className="text-xs text-destructive"
                        >
                          {degreeError}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`member-${index}-position`}>Cargo</Label>
                      <select
                        id={`member-${index}-position`}
                        disabled={isSubmitting}
                        aria-invalid={Boolean(membersError)}
                        aria-describedby={membersError ? 'committee-members-error' : undefined}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        {...register(`members.${index}.position`)}
                      >
                        <option value="PRESIDENT">Presidente</option>
                        <option value="MEMBER">Miembro</option>
                      </select>
                    </div>
                  </div>

                  {linkedUserId ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
                      <span className="inline-flex items-center gap-1.5 text-foreground">
                        <UserCheck className="size-4 text-success" aria-hidden="true" />
                        <span>Vinculado a {linkedUserName ?? linkedUserId}</span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isSubmitting}
                        onClick={() => {
                          setValue(`members.${index}.userId`, null);
                          setValue(`members.${index}.linkedUserName`, null);
                        }}
                      >
                        <Unlink className="mr-1.5 size-3.5" aria-hidden="true" />
                        Quitar vínculo
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label htmlFor={`member-${index}-userEmail`}>
                        Correo institucional (opcional)
                      </Label>
                      <Input
                        id={`member-${index}-userEmail`}
                        type="email"
                        placeholder="nombre.apellido@untrm.edu.pe"
                        disabled={isSubmitting}
                        aria-invalid={Boolean(userEmailError)}
                        aria-describedby={
                          userEmailError
                            ? `member-${index}-email-help member-${index}-userEmail-error`
                            : `member-${index}-email-help`
                        }
                        {...register(`members.${index}.userEmail`)}
                      />
                      {userEmailError && (
                        <p
                          id={`member-${index}-userEmail-error`}
                          role="alert"
                          className="text-xs text-destructive"
                        >
                          {userEmailError}
                        </p>
                      )}
                      <p
                        id={`member-${index}-email-help`}
                        className="text-xs text-muted-foreground"
                      >
                        Si tiene cuenta en el sistema, escribe su correo para vincularla.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {fieldErrors.members && (
            <p id="committee-members-error" role="alert" className="text-xs text-destructive">
              {fieldErrors.members}
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting || fields.length >= COMMITTEE_MEMBERS_MAX}
            onClick={() =>
              append({
                fullName: '',
                degree: '',
                position: 'MEMBER',
                userId: null,
                linkedUserName: null,
                userEmail: '',
              })
            }
          >
            <Plus className="mr-2 size-4" aria-hidden="true" />
            Agregar miembro
          </Button>
        </fieldset>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando…' : 'Guardar Comité'}
          </Button>
        </div>
      </form>
    </section>
  );
}
