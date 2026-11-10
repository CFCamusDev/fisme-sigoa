import { createFileRoute } from '@tanstack/react-router';
import { ProgramPage } from '@/features/parameters';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/configuracion/programa')({
  beforeLoad: () => guardPermission('parametro.ver'),
  component: ProgramRouteComponent,
});

function ProgramRouteComponent() {
  return <ProgramPage />;
}
