import { createFileRoute } from '@tanstack/react-router';
import { EditRolePage } from '@/features/authorization';

export const Route = createFileRoute('/_app/roles/$roleId/editar')({
  component: EditRoleRouteComponent,
});

function EditRoleRouteComponent() {
  const { roleId } = Route.useParams();
  return <EditRolePage roleId={roleId} />;
}
