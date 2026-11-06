import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CheckCircle2, AlertOctagon } from 'lucide-react';
import { ACTIVATION_TOKEN_MAX_LENGTH } from '@sigoa/shared';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ActivationForm } from './activation-form';

export interface ActivationPageProps {
  token: string;
}

type ActivationStatus = 'form' | 'invalid-link' | 'success';

export function ActivationPage({ token }: ActivationPageProps) {
  const isTokenOversizedOrMissing = !token || token.length > ACTIVATION_TOKEN_MAX_LENGTH;
  const [status, setStatus] = useState<ActivationStatus>(() =>
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
            Solicita uno nuevo al Administrador del sistema.
          </p>
        </header>

        <Button asChild variant="outline" className="w-full">
          <Link to="/login">Ir a iniciar sesión</Link>
        </Button>
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
            Cuenta activada
          </h1>
          <p className="text-body text-muted-foreground">
            Has completado la activación de tu cuenta institucional.
          </p>
        </header>

        <Alert variant="success" role="status">
          <CheckCircle2 className="size-5" />
          <AlertTitle>Activación exitosa</AlertTitle>
          <AlertDescription>Tu cuenta está activa. Ya puedes iniciar sesión.</AlertDescription>
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
        <h1 className="text-h2 font-bold tracking-tight text-foreground">Activar tu cuenta</h1>
        <p className="text-body text-muted-foreground">
          Define tu contraseña para activar tu acceso al sistema.
        </p>
      </header>

      <ActivationForm
        token={token}
        onSuccess={() => setStatus('success')}
        onInvalidToken={() => setStatus('invalid-link')}
      />
    </div>
  );
}
