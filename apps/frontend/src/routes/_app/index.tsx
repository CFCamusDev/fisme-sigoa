import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, Workflow } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/common';
import { NAV_GROUPS } from '@/components/layout/nav-items';
import { useNavGroups } from '@/components/layout/use-nav-groups';
import { Button } from '@/components/ui/button';
import { HealthStatus, useHealth } from '@/features/health';
import { getProcessTypeLabel, useProcessExecutions } from '@/features/processes';
import { usePermission } from '@/hooks/use-permission';
import { formatDateTime } from '@/lib/date';
import { getHomeQuickLinkGroups } from '@/lib/home-links';

export const Route = createFileRoute('/_app/')({
  component: DashboardPage,
});

export function DashboardPage() {
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useHealth();
  const resolvedGroups = useNavGroups(NAV_GROUPS);
  const quickLinkGroups = getHomeQuickLinkGroups(resolvedGroups);
  const isNavLoading = resolvedGroups.some((entry) => entry.isLoading);

  const { allowed: canViewExecutions, isLoading: isExecPermLoading } =
    usePermission('ejecucion.ver');
  const executionsQuery = useProcessExecutions(
    { status: 'IN_PROGRESS', pageSize: 5 },
    { enabled: canViewExecutions },
  );

  const healthState = isLoading ? 'loading' : isError ? 'error' : 'ok';
  const errorMessage = error instanceof Error ? error.message : undefined;
  const lastCheckedText = dataUpdatedAt ? formatDateTime(new Date(dataUpdatedAt)) : '—';
  const runningExecutions = executionsQuery.data?.items ?? [];

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

      <section aria-labelledby="home-quick-links-heading" className="space-y-4">
        <h2 id="home-quick-links-heading" className="text-h3 font-semibold text-foreground">
          Accesos rápidos
        </h2>

        {isNavLoading ? (
          <LoadingState message="Cargando accesos rápidos..." />
        ) : quickLinkGroups.length === 0 ? (
          <div className="surface p-6 text-body text-muted-foreground">
            Tu rol aún no tiene módulos asignados. Pide acceso al Administrador.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quickLinkGroups.map(({ group, items }) => (
              <div key={group.id} className="surface space-y-3 p-5">
                <h3 className="text-meta font-bold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </h3>
                <ul className="space-y-1.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          to={item.href}
                          className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-label font-medium text-foreground transition-colors motion-color hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          <span className="flex items-center gap-2.5">
                            {Icon ? (
                              <Icon className="size-4 shrink-0 text-brand-700" aria-hidden="true" />
                            ) : null}
                            <span>{item.title}</span>
                          </span>
                          <ArrowRight
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {!isExecPermLoading && canViewExecutions ? (
        <section aria-labelledby="home-executions-heading" className="space-y-4">
          <h2 id="home-executions-heading" className="text-h3 font-semibold text-foreground">
            Ejecuciones en curso
          </h2>

          {executionsQuery.isLoading ? (
            <LoadingState message="Cargando ejecuciones en curso..." />
          ) : executionsQuery.isError ? (
            <ErrorState
              title="No se pudieron cargar las ejecuciones"
              message="Ocurrió un problema al consultar las ejecuciones en curso."
              onRetry={() => void executionsQuery.refetch()}
            />
          ) : runningExecutions.length === 0 ? (
            <EmptyState
              icon={<Workflow className="size-8" aria-hidden="true" />}
              title="No hay ejecuciones en curso"
              description="Cuando inicies una ejecución de proceso aparecerá aquí para acceder rápido a su tablero."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {runningExecutions.map((execution) => (
                <div
                  key={execution.id}
                  className="surface flex items-center justify-between gap-4 p-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-label font-semibold text-foreground">
                        {execution.name}
                      </p>
                      <StatusBadge status={execution.status} />
                    </div>
                    <p className="text-meta text-muted-foreground">
                      {getProcessTypeLabel(execution.processType)} · Periodo {execution.period}
                    </p>
                  </div>
                  <Link
                    to="/ejecuciones/$executionId"
                    params={{ executionId: execution.id }}
                    className="shrink-0 rounded-md px-3 py-1.5 text-label font-semibold text-brand-700 transition-colors motion-color hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    Abrir tablero
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section aria-labelledby="home-health-heading" className="surface space-y-3 p-4">
        <h2 id="home-health-heading" className="text-label font-semibold text-foreground">
          Estado del sistema
        </h2>

        <div className="max-w-md">
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
