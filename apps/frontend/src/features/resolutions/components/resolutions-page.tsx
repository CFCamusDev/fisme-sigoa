import { useEffect, useRef, useState } from 'react';
import { CircleCheck, Plus } from 'lucide-react';
import type { ResolutionDto } from '@sigoa/shared';
import { Can } from '@/components/common/can';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { PageHeader } from '@/components/common/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useCatalogVersions } from '@/features/catalog';
import { useResolutions } from '../hooks/use-resolutions';
import { getResolutionErrorMessage } from '../lib/resolution-error-message';
import { formatResolutionType } from '../lib/resolution-labels';
import { RegisterResolutionForm } from './register-resolution-form';
import { ResolutionsTable } from './resolutions-table';

const LIST_PARAMS = { pageSize: 100 } as const;

export function ResolutionsPage() {
  const { data, isLoading, isError, error, refetch } = useResolutions(LIST_PARAMS);
  const versionsQuery = useCatalogVersions();
  const [showForm, setShowForm] = useState(false);
  const [registered, setRegistered] = useState<ResolutionDto | null>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  const resolutions = data?.items ?? [];
  const allVersions = versionsQuery.data?.items ?? [];
  const versionNumberById = new Map(allVersions.map((version) => [version.id, version.number]));
  const inValidation = allVersions.filter((version) => version.status === 'IN_VALIDATION');

  useEffect(() => {
    if (registered) {
      messageRef.current?.focus();
    }
  }, [registered]);

  function openForm() {
    setRegistered(null);
    setShowForm(true);
  }

  function handleRegistered(resolution: ResolutionDto) {
    setShowForm(false);
    setRegistered(resolution);
  }

  const registerButton = (
    <Can permission="resolucion.registrar" scope="GLOBAL">
      <Button type="button" onClick={openForm} disabled={showForm}>
        <Plus aria-hidden="true" />
        Registrar resolución
      </Button>
    </Can>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resoluciones"
        description="Resoluciones del Decano que aprueban los objetivos educacionales y los atributos del graduado."
        actions={registerButton}
      />

      {registered && (
        <div ref={messageRef} tabIndex={-1} className="outline-none focus-visible:outline-2">
          <Alert variant="success">
            <CircleCheck aria-hidden="true" />
            <AlertDescription>
              Se registró la resolución {registered.number} de{' '}
              {formatResolutionType(registered.type).toLowerCase()}. Queda pendiente de aprobación
              con el PDF firmado.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {showForm && (
        <RegisterResolutionForm
          versions={inValidation}
          versionsLoading={versionsQuery.isLoading}
          versionsDenied={versionsQuery.isError && versionsQuery.error?.status === 403}
          onCancel={() => setShowForm(false)}
          onRegistered={handleRegistered}
        />
      )}

      {isLoading && <LoadingState message="Cargando resoluciones..." />}

      {isError &&
        (error?.status === 403 ? (
          <ErrorState
            title="Acceso denegado"
            message="No tienes permiso para consultar las resoluciones."
            illustration="noPermission"
          />
        ) : (
          <ErrorState
            title="Error al cargar las resoluciones"
            message={getResolutionErrorMessage(error)}
            onRetry={() => void refetch()}
          />
        ))}

      {!isLoading && !isError && resolutions.length === 0 && (
        <EmptyState
          title="Aún no hay resoluciones registradas"
          description="Usa «Registrar resolución» para vincular la resolución del Decano a una versión del catálogo en validación y aprobarla después con su PDF firmado."
          illustration="empty"
        />
      )}

      {!isLoading && !isError && resolutions.length > 0 && (
        <ResolutionsTable resolutions={resolutions} versionNumberById={versionNumberById} />
      )}
    </div>
  );
}
