import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useActivateAccount } from '../hooks/use-activate-account';
import { activationFormSchema, type ActivationFormData } from '../schemas/activation-form-schema';
import { getActivationErrorMessage } from '../lib/get-activation-error-message';
import { PasswordFields } from './password-fields';

export interface ActivationFormProps {
  token: string;
  onSuccess: () => void;
  onInvalidToken: () => void;
}

export function ActivationForm({ token, onSuccess, onInvalidToken }: ActivationFormProps) {
  const mutation = useActivateAccount();
  const [generalError, setGeneralError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    setFocus,
    formState: { errors },
  } = useForm<ActivationFormData>({
    resolver: zodResolver(activationFormSchema),
    criteriaMode: 'all',
    mode: 'onSubmit',
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = (values: ActivationFormData) => {
    setGeneralError(null);
    mutation.mutate(
      {
        token,
        password: values.password,
      },
      {
        onSuccess: () => {
          onSuccess();
        },
        onError: (err) => {
          if (err.code === 'INVALID_ACTIVATION_TOKEN') {
            onInvalidToken();
            return;
          }

          if (err.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
            const passwordErrors = (
              err.details as Array<{ path?: unknown; message?: unknown }>
            ).filter(
              (d) =>
                typeof d?.path === 'string' &&
                d.path === 'body.password' &&
                typeof d.message === 'string',
            ) as Array<{ path: string; message: string }>;

            if (passwordErrors.length > 0) {
              passwordErrors.forEach((d) => {
                setError('password', { message: d.message });
              });
              setValue('confirmPassword', '');
              setFocus('password');
              return;
            }
          }

          setGeneralError(getActivationErrorMessage(err));
          setValue('password', '');
          setValue('confirmPassword', '');
          setFocus('password');
        },
      },
    );
  };

  const isPending = mutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {generalError && (
        <Alert variant="danger" role="alert">
          <AlertCircle className="size-5" />
          <AlertTitle>No se pudo activar la cuenta</AlertTitle>
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      )}

      <PasswordFields
        idPrefix="activation"
        register={register}
        errors={errors}
        disabled={isPending}
      />

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Activando…' : 'Activar cuenta'}
      </Button>
    </form>
  );
}
