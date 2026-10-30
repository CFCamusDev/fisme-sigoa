import { Button } from '@/components/ui/button';

export function LoginPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-h2 font-bold tracking-tight text-foreground">Iniciar sesión</h1>
        <p className="text-body text-muted-foreground">
          Ingresa tus credenciales institucionales para acceder al sistema.
        </p>
      </header>
      <div className="pt-2">
        <Button className="w-full">Acceder al sistema</Button>
      </div>
    </div>
  );
}
