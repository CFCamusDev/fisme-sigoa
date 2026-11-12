import { createFileRoute } from '@tanstack/react-router';
import { PageHeader } from '@/components/common';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/catalogo/versiones')({
  beforeLoad: () => guardPermission('catalogo.ver'),
  component: CatalogVersionsRouteComponent,
});

function CatalogVersionsRouteComponent() {
  return <PageHeader title="Versiones del catálogo" />;
}
