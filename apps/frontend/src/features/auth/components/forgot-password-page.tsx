import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ForgotPasswordForm } from './forgot-password-form';

export function ForgotPasswordPage() {
  const [isSuccess, setIsSuccess] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (isSuccess) {
      headingRef.current?.focus();
    }
  }, [isSuccess]);

  if (isSuccess) {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-h2 font-bold tracking-tight text-foreground outline-none"
          >
            Revisa tu correo
          </h1>
          <p className="text-body text-muted-foreground">
            Hemos enviado instrucciones a tu bandeja de entrada.
          </p>
        </header>

        <Alert variant="success" role="status">
          <CheckCircle2 className="size-5" />
          <AlertTitle>Enlace enviado</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>Si el correo existe, recibirás un enlace para restablecer tu contraseña.</p>
            <p>
              El enlace es de un solo uso y vence en 48 horas. Si no lo ves, revisa tu carpeta de
              correo no deseado.
            </p>
          </AlertDescription>
        </Alert>

        <Button asChild className="w-full">
          <Link to="/login">Volver a iniciar sesión</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-h2 font-bold tracking-tight text-foreground">
          ¿Olvidaste tu contraseña?
        </h1>
        <p className="text-body text-muted-foreground">
          Ingresa tu correo institucional y te enviaremos un enlace para restablecerla.
        </p>
      </header>

      <ForgotPasswordForm onSuccess={() => setIsSuccess(true)} />
    </div>
  );
}
