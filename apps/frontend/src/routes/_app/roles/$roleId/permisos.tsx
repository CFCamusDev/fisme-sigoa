import { createFileRoute } from '@tanstack/react-router';
import { RolePermissionsPage } from '@/features/authorization';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/roles/$roleId/permisos')({
  beforeLoad: () => guardPermission('rol.editar'),
  component: RolePermissionsRouteComponent,
});

function RolePermissionsRouteComponent() {
  const { roleId } = Route.useParams();
  return <RolePermissionsPage roleId={roleId} />;
}
