import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout';
import { LogoutButton } from '@/features/auth';

export const Route = createFileRoute('/_app')({
  component: AppRouteLayout,
});

function AppRouteLayout() {
  return (
    <AppLayout userMenu={<LogoutButton />}>
      <Outlet />
    </AppLayout>
  );
}
