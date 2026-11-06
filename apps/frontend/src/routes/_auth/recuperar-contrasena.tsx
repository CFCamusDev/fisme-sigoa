import { createFileRoute, redirect } from '@tanstack/react-router';
import { ForgotPasswordPage } from '@/features/auth';
import { useAuthStore, selectIsAuthenticated } from '@/stores/auth.store';

export const Route = createFileRoute('/_auth/recuperar-contrasena')({
  beforeLoad: () => {
    if (selectIsAuthenticated(useAuthStore.getState())) {
      throw redirect({ to: '/' });
    }
  },
  component: ForgotPasswordRouteComponent,
});

function ForgotPasswordRouteComponent() {
  return <ForgotPasswordPage />;
}
