import { createFileRoute, redirect } from '@tanstack/react-router';
import { LoginPage } from '@/features/auth';
import { useAuthStore, selectIsAuthenticated } from '@/stores/auth.store';

export const Route = createFileRoute('/_auth/login')({
  beforeLoad: () => {
    if (selectIsAuthenticated(useAuthStore.getState())) {
      throw redirect({ to: '/' });
    }
  },
  component: LoginPage,
});
