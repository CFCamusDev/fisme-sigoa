import { createFileRoute } from '@tanstack/react-router';
import { ParametersPage } from '@/features/parameters';
import { guardPermission } from '@/lib/permission-guard';
import { tabSearchSchema } from '@/lib/tab-param';

export const Route = createFileRoute('/_app/configuracion/parametros')({
  validateSearch: (search: Record<string, unknown>) => tabSearchSchema.parse(search),
  beforeLoad: () => guardPermission('parametro.ver'),
  component: ParametersRouteComponent,
});

function ParametersRouteComponent() {
  return <ParametersPage />;
}
