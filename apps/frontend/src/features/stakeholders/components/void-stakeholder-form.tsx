import { useEffect, useId, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert } from 'lucide-react';
import {
  STAKEHOLDER_VOID_REASON_MAX_LENGTH,
  voidStakeholderRequestSchema,
  type StakeholderDto,
  type VoidStakeholderRequest,
} from '@sigoa/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useVoidStakeholder } from '../hooks/use-void-stakeholder';
import { getStakeholderErrorMessage } from '../lib/stakeholder-error-message';
import { getStakeholderDocumentLabel } from '../lib/stakeholder-labels';

export interface VoidStakeholderFormProps {
  readonly stakeholder: StakeholderDto;
  readonly onCancel: () => void;
  readonly onVoided: (stakeholder: StakeholderDto) => void;
}

export function VoidStakeholderForm({ stakeholder, onCancel, onVoided }: VoidStakeholderFormProps) {
  const uid = useId();
  const mutation = useVoidStakeholder();
  const [formError, setFormError] = useState<string | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    control,
    setFocus,
    formState: { errors },
  } = useForm<VoidStakeholderRequest>({
    resolver: zodResolver(voidStakeholderRequestSchema),
    defaultValues: { reason: '' },
  });

  const reasonValue = useWatch({ control, name: 'reason' }) ?? '';

  useEffect(() => {
    setFocus('reason');
  }, [setFocus, stakeholder.id]);

  useEffect(() => {
    if (formError) {
      alertRef.current?.focus();
    }
  }, [formError]);

  async function submit(values: VoidStakeholderRequest) {
    setFormError(null);
    try {
      const updated = await mutation.mutateAsync({
        id: stakeholder.id,
        payload: values,
      });
      onVoided(updated);
    } catch (error) {
      setFormError(getStakeholderErrorMessage(error));
    }
  }

  const reasonId = `${uid}-reason`;
  const reasonErrorId = `${uid}-reason-error`;

  return (
    <form
      onSubmit={handleSubmit(submit)}
      noValidate
      className="space-y-4 rounded-lg border border-border bg-card p-6 text-card-foreground"
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Anular constituyente</h2>
        <p className="text-sm text-muted-foreground">
          {stakeholder.fullName} · {getStakeholderDocumentLabel(stakeholder)}
        </p>
      </div>

      <Alert variant="warning">
        <AlertDescription>
          El constituyente no se elimina: queda en el registro como anulado.
        </AlertDescription>
      </Alert>

      {formError ? (
        <Alert ref={alertRef} variant="danger" tabIndex={-1}>
          <CircleAlert className="size-4" aria-hidden="true" />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={reasonId}>Motivo de la anulación</Label>
          <span className="text-xs text-muted-foreground">
            {reasonValue.trim().length}/{STAKEHOLDER_VOID_REASON_MAX_LENGTH}
          </span>
        </div>
        <Textarea
          id={reasonId}
          rows={3}
          disabled={mutation.isPending}
          aria-invalid={errors.reason ? 'true' : undefined}
          aria-describedby={errors.reason ? reasonErrorId : undefined}
          className={cn(errors.reason && 'border-destructive')}
          {...register('reason')}
        />
        {errors.reason ? (
          <p id={reasonErrorId} role="alert" className="text-xs text-destructive">
            {errors.reason.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button type="submit" variant="destructive" disabled={mutation.isPending}>
          {mutation.isPending ? 'Anulando…' : 'Confirmar anulación'}
        </Button>
      </div>
    </form>
  );
}
