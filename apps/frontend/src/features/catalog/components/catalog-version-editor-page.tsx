import { Link } from '@tanstack/react-router';
import { ArrowLeft, Lock } from 'lucide-react';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePermission } from '@/hooks/use-permission';
import { useCatalogVersionDetail } from '../hooks/use-catalog-version-detail';
import { useCatalogVersions } from '../hooks/use-catalog-versions';
import { getCatalogErrorMessage } from '../lib/catalog-error-message';
import { formatVersionLabel } from './catalog-versions-table';
import { CatalogItemSection } from './catalog-item-section';
import { CatalogSendToValidation } from './catalog-send-to-validation';

export interface CatalogVersionEditorPageProps {
  readonly versionId: string;
}

const STATUS_LABEL: Record<string, string> = {
  IN_VALIDATION: 'En validación',
  APPROVED: 'Aprobada (vigente)',
  HISTORICAL: 'Histórica',
};

export function CatalogVersionEditorPage({ versionId }: CatalogVersionEditorPageProps) {
  const detailQuery = useCatalogVersionDetail(versionId);
  const versionsQuery = useCatalogVersions();
  const { allowed: canEdit } = usePermission('catalogo.editar', 'GLOBAL');

  const currentId = versionsQuery.data?.items.find((version) => version.status === 'APPROVED')?.id;
  const compareWithCurrent = Boolean(currentId) && currentId !== versionId;
  const currentQuery = useCatalogVersionDetail(currentId ?? '', { enabled: compareWithCurrent });

  const backLink = (
    <Link
      to="/catalogo/versiones"
      className="inline-flex items-center gap-1 text-label font-semibold text-primary underline-offset-4 hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Volver a las versiones
    </Link>
  );

  if (detailQuery.isLoading) {
    return <LoadingState message="Cargando la versión del catálogo..." />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    const status = detailQuery.error?.status;
    return (
      <div className="space-y-6">
        {backLink}
        {status === 403 ? (
          <ErrorState
            title="Acceso denegado"
            message="No tienes permiso para consultar el catálogo."
            illustration="noPermission"
          />
        ) : status === 404 ? (
          <ErrorState
            title="Versión no encontrada"
            message="La versión del catálogo no existe o ya no está disponible."
            illustration="notFound"
          />
        ) : (
          <ErrorState
            title="Error al cargar la versión"
            message={getCatalogErrorMessage(detailQuery.error)}
            onRetry={() => void detailQuery.refetch()}
          />
        )}
      </div>
    );
  }

  const { version, objectives, attributes } = detailQuery.data;
  const isDraft = version.status === 'DRAFT';
  const editable = canEdit && isDraft;
  const current = compareWithCurrent ? currentQuery.data : undefined;

  const lockReason = !isDraft
    ? `Esta versión está ${(STATUS_LABEL[version.status] ?? version.status).toLowerCase()}: sus campos están bloqueados. Solo se puede editar una versión en Borrador.`
    : !canEdit
      ? 'Solo lectura: no tienes permiso para editar el catálogo.'
      : null;

  return (
    <div className="space-y-6">
      {backLink}
      <PageHeader
        title={`Versión ${formatVersionLabel(version.number)} del catálogo`}
        description={
          editable
            ? 'Agrega, edita y ordena los objetivos educacionales y atributos del graduado. Las marcas Nuevo y Modificado comparan con la versión vigente.'
            : 'Objetivos educacionales y atributos del graduado de esta versión.'
        }
        actions={
          <StatusBadge
            status={version.status}
            label={version.status === 'APPROVED' ? 'Aprobada (vigente)' : undefined}
          />
        }
      />

      {lockReason && (
        <Alert variant="warning">
          <Lock aria-hidden="true" />
          <AlertDescription>{lockReason}</AlertDescription>
        </Alert>
      )}

      <CatalogItemSection
        kind="OBJECTIVES"
        versionId={version.id}
        items={objectives}
        currentItems={current?.objectives ?? []}
        editable={editable}
      />
      <CatalogItemSection
        kind="ATTRIBUTES"
        versionId={version.id}
        items={attributes}
        currentItems={current?.attributes ?? []}
        editable={editable}
      />

      {editable && (
        <CatalogSendToValidation
          versionId={version.id}
          objectiveCount={version.objectiveCount}
          attributeCount={version.attributeCount}
        />
      )}
    </div>
  );
}
