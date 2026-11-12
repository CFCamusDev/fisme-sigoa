import { createRootRoute, Outlet, useRouter } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { ApiError } from '@/lib/api-error';
import { ForbiddenRouteError } from '@/lib/permission-guard';
import { ForbiddenPage, NotFoundPage, UnexpectedErrorPage } from '@/components/common';

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: RootErrorComponent,
});

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}

function NotFoundComponent() {
  return <NotFoundPage />;
}

function RootErrorComponent({ error, reset }: { error: unknown; reset?: () => void }) {
  const router = useRouter();
  const isForbidden =
    error instanceof ForbiddenRouteError || (error instanceof ApiError && error.status === 403);

  if (isForbidden) {
    return <ForbiddenPage />;
  }

  return (
    <UnexpectedErrorPage
      onRetry={() => {
        if (reset) {
          reset();
        } else {
          router.invalidate();
        }
      }}
    />
  );
}
