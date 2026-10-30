import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { AlertCircle } from 'lucide-react';
import { loginRequestSchema, type LoginRequest } from '@sigoa/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import { useLogin } from '../hooks/use-login';
import { getLoginErrorMessage } from '../lib/login-error-message';

export function LoginForm() {
  const navigate = useNavigate();
  const { setAuthSession } = useAuth();
  const loginMutation = useLogin();

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    mode: 'onSubmit',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = (values: LoginRequest) => {
    loginMutation.mutate(values, {
      onSuccess: (data) => {
        setAuthSession(data);
        void navigate({ to: '/', replace: true });
      },
      onError: () => {
        setValue('password', '');
        setFocus('password');
      },
    });
  };

  const isPending = loginMutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {loginMutation.isError && (
        <Alert variant="danger" role="alert">
          <AlertCircle className="size-5" />
          <AlertTitle>No se pudo iniciar sesión</AlertTitle>
          <AlertDescription>{getLoginErrorMessage(loginMutation.error)}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="login-email">
          Correo electrónico{' '}
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
          <span className="sr-only">obligatorio</span>
        </Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="username"
          inputMode="email"
          placeholder="ejemplo@untrm.edu.pe"
          disabled={isPending}
          aria-invalid={errors.email ? 'true' : 'false'}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          {...register('email')}
        />
        {errors.email && (
          <p id="login-email-error" className="text-meta text-destructive" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="login-password">
          Contraseña{' '}
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
          <span className="sr-only">obligatorio</span>
        </Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          disabled={isPending}
          aria-invalid={errors.password ? 'true' : 'false'}
          aria-describedby={errors.password ? 'login-password-error' : undefined}
          {...register('password')}
        />
        {errors.password && (
          <p id="login-password-error" className="text-meta text-destructive" role="alert">
            {errors.password.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Ingresando…' : 'Acceder al sistema'}
      </Button>
    </form>
  );
}
