import { createFileRoute } from '@tanstack/react-router';
import { ProcessExecutionsPage } from '@/features/processes';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/ejecuciones')({
  beforeLoad: () => guardPermission('ejecucion.ver'),
  component: ProcessExecutionsRouteComponent,
});

function ProcessExecutionsRouteComponent() {
  return <ProcessExecutionsPage />;
}
