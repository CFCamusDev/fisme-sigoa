import { createFileRoute } from '@tanstack/react-router';
import { RolesPage } from '@/features/authorization';

export const Route = createFileRoute('/_app/roles/')({
  component: RolesRouteComponent,
});

function RolesRouteComponent() {
  return <RolesPage />;
}
