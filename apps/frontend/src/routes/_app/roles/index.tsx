import { createFileRoute } from '@tanstack/react-router';
import { RolesPage } from '@/features/authorization';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/roles/')({
  beforeLoad: () => guardPermission('rol.ver'),
  component: RolesRouteComponent,
});

function RolesRouteComponent() {
  return <RolesPage />;
}
