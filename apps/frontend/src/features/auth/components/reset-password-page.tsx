import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CheckCircle2, AlertOctagon } from 'lucide-react';
import { ACTIVATION_TOKEN_MAX_LENGTH } from '@sigoa/shared';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ResetPasswordForm } from './reset-password-form';

export interface ResetPasswordPageProps {
  token: string;
}

type ResetPasswordStatus = 'form' | 'invalid-link' | 'success';

export function ResetPasswordPage({ token }: ResetPasswordPageProps) {
  const isTokenOversizedOrMissing = !token || token.length > ACTIVATION_TOKEN_MAX_LENGTH;
  const [status, setStatus] = useState<ResetPasswordStatus>(() =>
    isTokenOversizedOrMissing ? 'invalid-link' : 'form',
  );

  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (status !== 'form') {
      headingRef.current?.focus();
    }
  }, [status]);

  if (status === 'invalid-link') {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-destructive">
            <AlertOctagon className="size-6" aria-hidden="true" />
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="text-h2 font-bold tracking-tight text-foreground outline-none"
            >
              El enlace no es válido o venció.
            </h1>
          </div>
          <p className="text-body text-muted-foreground">
            Solicita uno nuevo desde «¿Olvidaste tu contraseña?».
          </p>
        </header>

        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link to="/recuperar-contrasena">Solicitar un enlace nuevo</Link>
          </Button>

          <Button asChild variant="outline" className="w-full">
            <Link to="/login">Ir a iniciar sesión</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-h2 font-bold tracking-tight text-foreground outline-none"
          >
            Contraseña actualizada
          </h1>
          <p className="text-body text-muted-foreground">
            Has restablecido la contraseña de tu cuenta.
          </p>
        </header>

        <Alert variant="success" role="status">
          <CheckCircle2 className="size-5" />
          <AlertTitle>Contraseña actualizada</AlertTitle>
          <AlertDescription>
            Tu contraseña se actualizó y cerramos tus sesiones abiertas. Inicia sesión con la nueva
            contraseña.
          </AlertDescription>
        </Alert>

        <Button asChild className="w-full">
          <Link to="/login">Ir a iniciar sesión</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-h2 font-bold tracking-tight text-foreground">
          Restablecer tu contraseña
        </h1>
        <p className="text-body text-muted-foreground">
          Define una nueva contraseña para tu cuenta.
        </p>
      </header>

      <ResetPasswordForm
        token={token}
        onSuccess={() => setStatus('success')}
        onInvalidToken={() => setStatus('invalid-link')}
      />
    </div>
  );
}
