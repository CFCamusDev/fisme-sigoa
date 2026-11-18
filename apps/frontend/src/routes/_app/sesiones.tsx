import { createFileRoute } from '@tanstack/react-router';
import { SessionsPage } from '@/features/sessions';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/sesiones')({
  beforeLoad: () => guardPermission('sesion.ver'),
  component: SessionsRouteComponent,
});

function SessionsRouteComponent() {
  return <SessionsPage />;
}
