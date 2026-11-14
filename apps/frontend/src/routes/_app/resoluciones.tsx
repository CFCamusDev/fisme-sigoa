import { createFileRoute } from '@tanstack/react-router';
import { ResolutionsPage } from '@/features/resolutions';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/resoluciones')({
  beforeLoad: () => guardPermission('resolucion.ver'),
  component: ResolutionsRouteComponent,
});

function ResolutionsRouteComponent() {
  return <ResolutionsPage />;
}
