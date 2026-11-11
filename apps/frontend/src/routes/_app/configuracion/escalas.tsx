import { createFileRoute } from '@tanstack/react-router';
import { ResponseScalesPage } from '@/features/parameters';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/configuracion/escalas')({
  beforeLoad: () => guardPermission('parametro.ver'),
  component: ResponseScalesRouteComponent,
});

function ResponseScalesRouteComponent() {
  return <ResponseScalesPage />;
}
