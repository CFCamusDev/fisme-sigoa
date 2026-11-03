import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoginForm } from './login-form';

export interface LoginPageProps {
  reason?: 'session-expired';
}

export function LoginPage({ reason }: LoginPageProps = {}) {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-h2 font-bold tracking-tight text-foreground">Iniciar sesión</h1>
        <p className="text-body text-muted-foreground">
          Ingresa tus credenciales institucionales para acceder al sistema.
        </p>
      </header>

      {reason === 'session-expired' && (
        <Alert variant="warning" role="status">
          <AlertDescription>Tu sesión expiró. Inicia sesión nuevamente.</AlertDescription>
        </Alert>
      )}

      <LoginForm />
    </div>
  );
}
