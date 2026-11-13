import { createFileRoute } from '@tanstack/react-router';
import { CatalogVersionsPage } from '@/features/catalog';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/catalogo/versiones')({
  beforeLoad: () => guardPermission('catalogo.ver'),
  component: CatalogVersionsRouteComponent,
});

function CatalogVersionsRouteComponent() {
  return <CatalogVersionsPage />;
}
