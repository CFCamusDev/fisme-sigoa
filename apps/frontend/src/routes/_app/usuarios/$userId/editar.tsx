import { createFileRoute } from '@tanstack/react-router';
import { EditUserPage } from '@/features/users';

export const Route = createFileRoute('/_app/usuarios/$userId/editar')({
  component: EditUserRouteComponent,
});

function EditUserRouteComponent() {
  const { userId } = Route.useParams();
  return <EditUserPage userId={userId} />;
}
