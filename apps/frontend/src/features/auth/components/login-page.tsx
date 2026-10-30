import { LoginForm } from './login-form';

export function LoginPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-h2 font-bold tracking-tight text-foreground">Iniciar sesión</h1>
        <p className="text-body text-muted-foreground">
          Ingresa tus credenciales institucionales para acceder al sistema.
        </p>
      </header>
      <LoginForm />
    </div>
  );
}
