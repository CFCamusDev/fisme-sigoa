import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: RootErrorComponent,
});

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}

function NotFoundComponent() {
  return (
    <main
      role="region"
      aria-label="Página no encontrada"
      className="flex min-h-screen flex-col items-center justify-center p-6 text-center"
    >
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Página no encontrada</h1>
      <p className="mt-2 text-sm text-neutral-600">
        La ruta solicitada no existe o ha sido movida.
      </p>
      <Link
        to="/"
        className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400"
      >
        Volver al inicio
      </Link>
    </main>
  );
}

function RootErrorComponent({ error }: { error: unknown }) {
  const errorMessage = error instanceof Error ? error.message : 'Error inesperado del sistema';

  return (
    <main
      role="alert"
      aria-live="assertive"
      className="flex min-h-screen flex-col items-center justify-center p-6 text-center"
    >
      <h1 className="text-3xl font-bold tracking-tight text-red-600">Ha ocurrido un error</h1>
      <p className="mt-2 max-w-md text-sm text-neutral-600">{errorMessage}</p>
      <Link
        to="/"
        className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400"
      >
        Ir a la página principal
      </Link>
    </main>
  );
}
