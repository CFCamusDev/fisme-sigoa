import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useActivateAccount } from '../hooks/use-activate-account';
import { activationFormSchema, type ActivationFormData } from '../schemas/activation-form-schema';
import { getActivationErrorMessage } from '../lib/get-activation-error-message';

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
              return;
            }
          }

          // Error recuperable (RATE_LIMITED, NETWORK_ERROR, 500, etc.)
          setGeneralError(getActivationErrorMessage(err));
          setValue('password', '');
          setValue('confirmPassword', '');
          setFocus('password');
        },
      },
    );
  };

  const isPending = mutation.isPending;

  // Extrae todos los mensajes de error de la política para criteriaMode: 'all'
  const passwordErrorMessages: string[] = [];
  if (errors.password) {
    if (errors.password.types) {
      for (const val of Object.values(errors.password.types)) {
        if (Array.isArray(val)) {
          passwordErrorMessages.push(...val.filter((m): m is string => typeof m === 'string'));
        } else if (typeof val === 'string') {
          passwordErrorMessages.push(val);
        }
      }
    } else if (errors.password.message) {
      passwordErrorMessages.push(errors.password.message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {generalError && (
        <Alert variant="danger" role="alert">
          <AlertCircle className="size-5" />
          <AlertTitle>No se pudo activar la cuenta</AlertTitle>
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="activation-password">
          Nueva contraseña{' '}
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
          <span className="sr-only">obligatorio</span>
        </Label>
        <Input
          id="activation-password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••••"
          disabled={isPending}
          aria-invalid={errors.password ? 'true' : 'false'}
          aria-describedby={
            errors.password
              ? 'activation-password-hint activation-password-errors'
              : 'activation-password-hint'
          }
          {...register('password')}
        />
        <p id="activation-password-hint" className="text-meta text-muted-foreground">
          Mínimo 10 caracteres, con letras y números.
        </p>
        {passwordErrorMessages.length > 0 && (
          <ul
            id="activation-password-errors"
            className="space-y-1 text-meta text-destructive"
            role="alert"
          >
            {passwordErrorMessages.map((msg, idx) => (
              <li key={idx} className="flex items-center gap-1.5">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{msg}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="activation-confirm-password">
          Confirmar contraseña{' '}
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
          <span className="sr-only">obligatorio</span>
        </Label>
        <Input
          id="activation-confirm-password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••••"
          disabled={isPending}
          aria-invalid={errors.confirmPassword ? 'true' : 'false'}
          aria-describedby={errors.confirmPassword ? 'activation-confirm-error' : undefined}
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p id="activation-confirm-error" className="text-meta text-destructive" role="alert">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Activando…' : 'Activar cuenta'}
      </Button>
    </form>
  );
}
