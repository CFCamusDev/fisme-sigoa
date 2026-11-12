import { z } from 'zod';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { LoginPage } from '@/features/auth';
import { useAuthStore, selectIsAuthenticated } from '@/stores/auth.store';

const loginSearchSchema = z.object({
  reason: z.enum(['session-expired']).optional(),
});

export type LoginSearch = z.infer<typeof loginSearchSchema>;

export const Route = createFileRoute('/_auth/login')({
  validateSearch: (search) => loginSearchSchema.parse(search),
  beforeLoad: () => {
    if (selectIsAuthenticated(useAuthStore.getState())) {
      throw redirect({ to: '/' });
    }
  },
  component: LoginRouteComponent,
});

function LoginRouteComponent() {
  const { reason } = Route.useSearch();
  return <LoginPage reason={reason} />;
}
