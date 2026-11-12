import { useEffect, useRef } from 'react';
import { CircleAlert, CircleCheck, Plus } from 'lucide-react';
import type { CatalogVersionDto } from '@sigoa/shared';
import { Can } from '@/components/common/can';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { PageHeader } from '@/components/common/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useCatalogVersions } from '../hooks/use-catalog-versions';
import { useCreateCatalogVersion } from '../hooks/use-create-catalog-version';
import { getCatalogErrorMessage } from '../lib/catalog-error-message';
import { CatalogVersionsTable } from './catalog-versions-table';

const HELP_ID = 'catalog-open-version-help';

function findOpenVersion(versions: readonly CatalogVersionDto[]): CatalogVersionDto | undefined {
  return versions.find(
    (version) => version.status === 'DRAFT' || version.status === 'IN_VALIDATION',
  );
}

export function CatalogVersionsPage() {
  const { data, isLoading, isError, error, refetch } = useCatalogVersions();
  const createMutation = useCreateCatalogVersion();
  const inFlight = useRef(false);
  const messageRef = useRef<HTMLDivElement>(null);

  const versions = data?.items ?? [];
  const openVersion = findOpenVersion(versions);
  const created = createMutation.isSuccess ? createMutation.data : undefined;
  const createFailed = createMutation.isError ? createMutation.error : undefined;
  const hasMessage = Boolean(created) || Boolean(createFailed);

  useEffect(() => {
    if (hasMessage) {
      messageRef.current?.focus();
    }
  }, [hasMessage, created?.id, createFailed]);

  function handleCreate() {
    // Un solo envío a la vez (doble clic) y nunca con una versión abierta (CA2).
    if (inFlight.current || openVersion) {
      return;
    }
    inFlight.current = true;
    createMutation.mutate(undefined, {
      onSettled: () => {
        inFlight.current = false;
      },
    });
  }

  const blocked = Boolean(openVersion);

  const newVersionButton = (
    <Button
      type="button"
      onClick={handleCreate}
      disabled={createMutation.isPending}
      aria-disabled={blocked || createMutation.isPending}
      aria-describedby={blocked ? HELP_ID : undefined}
      className={blocked ? 'opacity-50' : undefined}
    >
      <Plus aria-hidden="true" />
      {createMutation.isPending ? 'Creando versión…' : 'Nueva versión'}
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Versiones del catálogo"
        description="Versiones de los objetivos educacionales (OE) y atributos del graduado (AG) del programa."
        actions={
          <Can permission="catalogo.editar" scope="GLOBAL">
            {newVersionButton}
          </Can>
        }
      />

      <Can permission="catalogo.editar" scope="GLOBAL">
        {openVersion && (
          <p id={HELP_ID} className="text-sm text-muted-foreground">
            Ya existe la versión {openVersion.number} en{' '}
            {openVersion.status === 'DRAFT' ? 'Borrador' : 'En validación'}; ciérrala o apruébala
            antes de crear otra.
          </p>
        )}
      </Can>

      {hasMessage && (
        <div ref={messageRef} tabIndex={-1} className="outline-none focus-visible:outline-2">
          {created && (
            <Alert variant="success">
              <CircleCheck aria-hidden="true" />
              <AlertDescription>
                Se creó la versión {created.number} en Borrador con una copia de la versión vigente.
              </AlertDescription>
            </Alert>
          )}
          {createFailed && (
            <Alert variant="danger">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{getCatalogErrorMessage(createFailed)}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {isLoading && <LoadingState message="Cargando versiones del catálogo..." />}

      {isError &&
        (error?.status === 403 ? (
          <ErrorState
            title="Acceso denegado"
            message="No tienes permiso para consultar el catálogo."
            illustration="noPermission"
          />
        ) : (
          <ErrorState
            title="Error al cargar las versiones"
            message={getCatalogErrorMessage(error)}
            onRetry={() => void refetch()}
          />
        ))}

      {!isLoading && !isError && versions.length === 0 && (
        <EmptyState
          title="Aún no hay versiones del catálogo"
          description="Crea la primera versión para registrar los objetivos educacionales y atributos del graduado."
          illustration="empty"
        />
      )}

      {!isLoading && !isError && versions.length > 0 && (
        <CatalogVersionsTable versions={versions} />
      )}
    </div>
  );
}
