import { createFileRoute } from '@tanstack/react-router';
import { AnnexesPage } from '@/features/annexes';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/anexos')({
  beforeLoad: () => guardPermission('documento.descargar'),
  component: AnnexesRouteComponent,
});

function AnnexesRouteComponent() {
  return <AnnexesPage />;
}
