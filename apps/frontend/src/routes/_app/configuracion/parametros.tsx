import { createFileRoute } from '@tanstack/react-router';
import { ParametersPage } from '@/features/parameters';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/configuracion/parametros')({
  beforeLoad: () => guardPermission('parametro.ver'),
  component: ParametersRouteComponent,
});

function ParametersRouteComponent() {
  return <ParametersPage />;
}
