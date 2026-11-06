import { createFileRoute } from '@tanstack/react-router';
import { ResetPasswordPage } from '@/features/auth';

export const Route = createFileRoute('/_auth/restablecer/$token')({
  component: ResetPasswordRouteComponent,
});

function ResetPasswordRouteComponent() {
  const { token } = Route.useParams();
  return <ResetPasswordPage token={token} />;
}
