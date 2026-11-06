import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { AlertCircle } from 'lucide-react';
import { forgotPasswordRequestSchema, type ForgotPasswordRequest } from '@sigoa/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRequestPasswordRecovery } from '../hooks/use-request-password-recovery';
import { getPasswordRecoveryErrorMessage } from '../lib/get-password-recovery-error-message';

export interface ForgotPasswordFormProps {
  onSuccess: () => void;
}

export function ForgotPasswordForm({ onSuccess }: ForgotPasswordFormProps) {
  const mutation = useRequestPasswordRecovery();
  const [generalError, setGeneralError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<ForgotPasswordRequest>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    mode: 'onSubmit',
    defaultValues: {
      email: '',
    },
  });

  const isPending = mutation.isPending;

  const onSubmit = (values: ForgotPasswordRequest) => {
    if (isPending) return;
    setGeneralError(null);

    mutation.mutate(values, {
      onSuccess: () => {
        onSuccess();
      },
      onError: (err) => {
        setGeneralError(getPasswordRecoveryErrorMessage(err));
        setFocus('email');
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {generalError && (
        <Alert variant="danger" role="alert">
          <AlertCircle className="size-5" />
          <AlertTitle>No se pudo enviar el enlace</AlertTitle>
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="recovery-email">
          Correo electrónico{' '}
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
          <span className="sr-only">obligatorio</span>
        </Label>
        <Input
          id="recovery-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="ejemplo@untrm.edu.pe"
          disabled={isPending}
          aria-invalid={errors.email ? 'true' : 'false'}
          aria-describedby={errors.email ? 'recovery-email-error' : undefined}
          {...register('email')}
        />
        {errors.email && (
          <p id="recovery-email-error" className="text-meta text-destructive" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2 pt-2">
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Enviando…' : 'Enviar enlace'}
        </Button>

        <Button asChild variant="outline" className="w-full" disabled={isPending}>
          <Link to="/login">Volver a iniciar sesión</Link>
        </Button>
      </div>
    </form>
  );
}
