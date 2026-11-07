import { createFileRoute } from '@tanstack/react-router';
import { RolePermissionsPage } from '@/features/authorization';

export const Route = createFileRoute('/_app/roles/$roleId/permisos')({
  component: RolePermissionsRouteComponent,
});

function RolePermissionsRouteComponent() {
  const { roleId } = Route.useParams();
  return <RolePermissionsPage roleId={roleId} />;
}
