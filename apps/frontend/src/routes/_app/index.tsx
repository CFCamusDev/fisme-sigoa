import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { HealthStatus, useHealth } from '@/features/health';
import { formatDateTime } from '@/lib/date';

export const Route = createFileRoute('/_app/')({
  component: DashboardPage,
});

export function DashboardPage() {
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useHealth();

  const healthState = isLoading ? 'loading' : isError ? 'error' : 'ok';
  const errorMessage = error instanceof Error ? error.message : undefined;
  const lastCheckedText = dataUpdatedAt ? formatDateTime(new Date(dataUpdatedAt)) : '—';

  return (
    <main className="p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">FISME-SIGOA</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Sistema Integrado de Gestión de Objetivos Educacionales y Atributos del Graduado
        </p>
      </header>
      <section className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-6">
        <h2 className="text-lg font-medium text-neutral-900">Bienvenido al sistema</h2>
        <p className="text-sm text-neutral-600">
          La aplicación frontend base se encuentra configurada y lista.
        </p>
        <div className="max-w-md pt-2">
          <HealthStatus
            status={healthState}
            message={
              isError
                ? errorMessage
                : data?.status === 'ok'
                  ? 'Servicios de backend operativos (/health)'
                  : undefined
            }
          />
        </div>
        <p className="text-xs text-neutral-500">
          Última comprobación:{' '}
          <span className="font-medium text-neutral-700">{lastCheckedText}</span>
        </p>
        <div className="pt-2">
          <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? 'Comprobando...' : 'Comprobar estado del servidor'}
          </Button>
        </div>
      </section>
    </main>
  );
}
