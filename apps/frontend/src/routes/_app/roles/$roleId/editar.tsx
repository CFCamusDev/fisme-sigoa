import { createFileRoute } from '@tanstack/react-router';
import { EditRolePage } from '@/features/authorization';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/roles/$roleId/editar')({
  beforeLoad: () => guardPermission('rol.editar'),
  component: EditRoleRouteComponent,
});

function EditRoleRouteComponent() {
  const { roleId } = Route.useParams();
  return <EditRolePage roleId={roleId} />;
}
