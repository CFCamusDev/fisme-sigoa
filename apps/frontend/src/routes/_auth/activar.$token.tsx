import { createFileRoute } from '@tanstack/react-router';
import { ActivationPage } from '@/features/auth';

export const Route = createFileRoute('/_auth/activar/$token')({
  component: ActivateRouteComponent,
});

function ActivateRouteComponent() {
  const { token } = Route.useParams();
  return <ActivationPage token={token} />;
}
