import { createFileRoute } from '@tanstack/react-router';
import { CatalogVersionEditorPage } from '@/features/catalog';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/catalogo/versiones_/$versionId')({
  beforeLoad: () => guardPermission('catalogo.ver'),
  component: CatalogVersionEditorRouteComponent,
});

function CatalogVersionEditorRouteComponent() {
  const { versionId } = Route.useParams();
  return <CatalogVersionEditorPage versionId={versionId} />;
}
