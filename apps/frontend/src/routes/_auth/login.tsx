import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_auth/login')({
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Iniciar sesión</h1>
        <p className="text-sm text-neutral-500">
          Ingresa tus credenciales institucionales para acceder al sistema.
        </p>
      </header>
      <div className="pt-2">
        <Button className="w-full">Acceder al sistema</Button>
      </div>
    </div>
  );
}
