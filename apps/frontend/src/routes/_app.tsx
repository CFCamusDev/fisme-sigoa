import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout';
import { UserMenu } from '@/features/auth';
import { selectIsAuthenticated, useAuthStore } from '@/stores/auth.store';

export const Route = createFileRoute('/_app')({
  beforeLoad: () => {
    if (!selectIsAuthenticated(useAuthStore.getState())) {
      throw redirect({ to: '/login' });
    }
  },
  component: AppRouteLayout,
});

function AppRouteLayout() {
  return (
    <AppLayout userMenu={<UserMenu />}>
      <Outlet />
    </AppLayout>
  );
}
