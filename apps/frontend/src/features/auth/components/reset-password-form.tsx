import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useResetPassword } from '../hooks/use-reset-password';
import {
  passwordConfirmationSchema,
  type PasswordConfirmationFormData,
} from '../schemas/password-confirmation-schema';
import { getResetPasswordErrorMessage } from '../lib/get-reset-password-error-message';
import { PasswordFields } from './password-fields';

export interface ResetPasswordFormProps {
  token: string;
  onSuccess: () => void;
  onInvalidToken: () => void;
}

export function ResetPasswordForm({ token, onSuccess, onInvalidToken }: ResetPasswordFormProps) {
  const mutation = useResetPassword();
  const [generalError, setGeneralError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    setFocus,
    formState: { errors },
  } = useForm<PasswordConfirmationFormData>({
    resolver: zodResolver(passwordConfirmationSchema),
    criteriaMode: 'all',
    mode: 'onSubmit',
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = (values: PasswordConfirmationFormData) => {
    if (mutation.isPending) return;

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
          if (err.code === 'INVALID_PASSWORD_RESET_TOKEN') {
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

          setGeneralError(getResetPasswordErrorMessage(err));
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
          <AlertTitle>No se pudo restablecer la contraseña</AlertTitle>
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      )}

      <PasswordFields idPrefix="reset" register={register} errors={errors} disabled={isPending} />

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Restableciendo…' : 'Restablecer contraseña'}
      </Button>
    </form>
  );
}
