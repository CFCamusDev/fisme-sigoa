import { createFileRoute } from '@tanstack/react-router';
import { EditUserPage } from '@/features/users';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/usuarios/$userId/editar')({
  beforeLoad: () => guardPermission('usuario.editar'),
  component: EditUserRouteComponent,
});

function EditUserRouteComponent() {
  const { userId } = Route.useParams();
  return <EditUserPage userId={userId} />;
}
