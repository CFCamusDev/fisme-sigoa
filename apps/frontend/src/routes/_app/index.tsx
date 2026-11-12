import { createFileRoute } from '@tanstack/react-router';
import { PageHeader } from '@/components/common';
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
    <div className="space-y-6">
      <PageHeader
        title="FISME-SIGOA"
        description="Sistema Integrado de Gestión de Objetivos Educacionales y Atributos del Graduado"
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? 'Comprobando...' : 'Comprobar estado'}
          </Button>
        }
      />

      <section className="surface space-y-4 p-6">
        <h2 className="text-h3 font-medium text-foreground">Bienvenido al sistema</h2>
        <p className="text-body text-muted-foreground">
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

        <p className="text-meta text-muted-foreground">
          Última comprobación:{' '}
          <span className="font-medium text-foreground">{lastCheckedText}</span>
        </p>
      </section>
    </div>
  );
}
