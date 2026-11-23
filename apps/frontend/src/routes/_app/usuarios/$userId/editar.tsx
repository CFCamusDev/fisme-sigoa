import { createFileRoute } from '@tanstack/react-router';
import { EditUserPage } from '@/features/users';
import { guardPermission } from '@/lib/permission-guard';
import { tabSearchSchema } from '@/lib/tab-param';

export const Route = createFileRoute('/_app/usuarios/$userId/editar')({
  validateSearch: (search: Record<string, unknown>) => tabSearchSchema.parse(search),
  beforeLoad: () => guardPermission('usuario.editar'),
  component: EditUserRouteComponent,
});

function EditUserRouteComponent() {
  const { userId } = Route.useParams();
  return <EditUserPage userId={userId} />;
}
