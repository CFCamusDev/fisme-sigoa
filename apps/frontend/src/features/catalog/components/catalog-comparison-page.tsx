import { useId, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, CircleAlert } from 'lucide-react';
import type { CatalogVersionDto } from '@sigoa/shared';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { PageHeader } from '@/components/common/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { getStatusDescriptor } from '@/lib/status';
import { useCatalogComparison } from '../hooks/use-catalog-comparison';
import { useCatalogVersions } from '../hooks/use-catalog-versions';
import { getCatalogErrorMessage } from '../lib/catalog-error-message';
import { CatalogComparisonDiff, CatalogItemChangeBadge } from './catalog-comparison-diff';
import { CatalogVersionHistoryPanel } from './catalog-version-history-panel';
import { formatVersionLabel } from './catalog-versions-table';

export interface CatalogComparisonSelection {
  readonly base?: string;
  readonly target?: string;
}

export interface CatalogComparisonPageProps {
  /** Selección tomada de la URL (D8); lo que falte se completa con la versión anterior y la vigente. */
  readonly selection: CatalogComparisonSelection;
  readonly onSelectionChange: (selection: Required<CatalogComparisonSelection>) => void;
}

function versionOptionLabel(version: CatalogVersionDto): string {
  const status =
    version.status === 'APPROVED'
      ? 'Aprobada (vigente)'
      : getStatusDescriptor(version.status).label;
  return `${formatVersionLabel(version.number)} · ${status}`;
}

/** Destino por defecto: la vigente; base: la versión inmediatamente anterior a ella. */
function defaultSelection(versions: readonly CatalogVersionDto[]): CatalogComparisonSelection {
  const target = versions.find((version) => version.status === 'APPROVED') ?? versions[0];
  if (!target) {
    return {};
  }
  const base =
    versions
      .filter((version) => version.number < target.number)
      .sort((left, right) => right.number - left.number)[0] ??
    versions.find((version) => version.id !== target.id);
  return { base: base?.id, target: target.id };
}

export function CatalogComparisonPage({
  selection,
  onSelectionChange,
}: CatalogComparisonPageProps) {
  const baseSelectId = useId();
  const targetSelectId = useId();
  const unchangedId = useId();
  const [showUnchanged, setShowUnchanged] = useState(false);
  const versionsQuery = useCatalogVersions();

  const versions = versionsQuery.data?.items ?? [];
  const defaults = defaultSelection(versions);
  const baseId = selection.base ?? defaults.base ?? '';
  const targetId = selection.target ?? defaults.target ?? '';
  const sameVersion = baseId !== '' && baseId === targetId;

  const comparison = useCatalogComparison(baseId || undefined, targetId || undefined);

  const backLink = (
    <Link
      to="/catalogo/versiones"
      className="inline-flex items-center gap-1 text-label font-semibold text-primary underline-offset-4 hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Volver a las versiones
    </Link>
  );

  const header = (
    <PageHeader
      title="Historial del catálogo"
      description="Compara dos versiones de los objetivos educacionales (OE) y atributos del graduado (AG) y consulta su resolución y vigencia."
    />
  );

  if (versionsQuery.isLoading) {
    return (
      <div className="space-y-6">
        {backLink}
        {header}
        <LoadingState message="Cargando versiones del catálogo..." />
      </div>
    );
  }

  if (versionsQuery.isError) {
    return (
      <div className="space-y-6">
        {backLink}
        {header}
        {versionsQuery.error?.status === 403 ? (
          <ErrorState
            title="Acceso denegado"
            message="No tienes permiso para consultar el catálogo."
            illustration="noPermission"
          />
        ) : (
          <ErrorState
            title="Error al cargar las versiones"
            message={getCatalogErrorMessage(versionsQuery.error)}
            onRetry={() => void versionsQuery.refetch()}
          />
        )}
      </div>
    );
  }

  if (versions.length < 2) {
    return (
      <div className="space-y-6">
        {backLink}
        {header}
        <EmptyState
          title="Aún no hay versiones para comparar"
          description="Se necesitan al menos dos versiones del catálogo para ver sus diferencias."
          illustration="empty"
        />
      </div>
    );
  }

  const data = comparison.data;

  return (
    <div className="space-y-6">
      {backLink}
      {header}

      <form
        className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm sm:grid-cols-2 sm:p-6"
        onSubmit={(event) => event.preventDefault()}
        aria-label="Elegir las versiones a comparar"
      >
        <div className="space-y-2">
          <Label htmlFor={baseSelectId}>Versión base</Label>
          <Select
            id={baseSelectId}
            value={baseId}
            onChange={(event) => onSelectionChange({ base: event.target.value, target: targetId })}
          >
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {versionOptionLabel(version)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={targetSelectId}>Versión destino</Label>
          <Select
            id={targetSelectId}
            value={targetId}
            onChange={(event) => onSelectionChange({ base: baseId, target: event.target.value })}
          >
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {versionOptionLabel(version)}
              </option>
            ))}
          </Select>
        </div>
      </form>

      {sameVersion && (
        <Alert variant="warning">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>
            Elige dos versiones distintas para ver sus diferencias.
          </AlertDescription>
        </Alert>
      )}

      {!sameVersion && comparison.isLoading && (
        <LoadingState message="Comparando las versiones..." />
      )}

      {!sameVersion &&
        comparison.isError &&
        (comparison.error?.status === 403 ? (
          <ErrorState
            title="Acceso denegado"
            message="No tienes permiso para consultar el catálogo."
            illustration="noPermission"
          />
        ) : comparison.error?.status === 404 ? (
          <ErrorState
            title="Versión no encontrada"
            message="Alguna de las versiones ya no existe. Actualiza la página y elige otra."
            illustration="notFound"
          />
        ) : (
          <ErrorState
            title="Error al comparar las versiones"
            message={
              comparison.error?.status === 400
                ? 'Las versiones deben ser distintas y del mismo programa.'
                : getCatalogErrorMessage(comparison.error)
            }
            onRetry={() => void comparison.refetch()}
          />
        ))}

      {!sameVersion && data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CatalogVersionHistoryPanel
              heading={`Versión base ${formatVersionLabel(data.base.version.number)}`}
              headingLevel={2}
              history={data.base.history}
              status={data.base.version.status}
            />
            <CatalogVersionHistoryPanel
              heading={`Versión destino ${formatVersionLabel(data.target.version.number)}`}
              headingLevel={2}
              history={data.target.history}
              status={data.target.version.status}
            />
          </div>

          <section
            aria-labelledby="catalog-comparison-summary"
            className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-6"
          >
            <h2 id="catalog-comparison-summary" className="text-base font-semibold text-foreground">
              Resumen de cambios
            </h2>
            <ul className="mt-3 flex flex-wrap gap-4 text-sm text-foreground">
              {(
                [
                  ['ADDED', data.summary.added],
                  ['REMOVED', data.summary.removed],
                  ['MODIFIED', data.summary.modified],
                  ['UNCHANGED', data.summary.unchanged],
                ] as const
              ).map(([change, count]) => (
                <li key={change} className="flex items-center gap-2">
                  <CatalogItemChangeBadge change={change} />
                  <span className="font-semibold">{count}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center gap-2">
              <Checkbox
                id={unchangedId}
                checked={showUnchanged}
                onChange={(event) => setShowUnchanged(event.target.checked)}
              />
              <Label htmlFor={unchangedId}>Mostrar también los elementos sin cambios</Label>
            </div>
          </section>

          <CatalogComparisonDiff
            title="Objetivos educacionales"
            items={data.objectives}
            showUnchanged={showUnchanged}
          />
          <CatalogComparisonDiff
            title="Atributos del graduado"
            items={data.attributes}
            showUnchanged={showUnchanged}
          />
        </div>
      )}
    </div>
  );
}
