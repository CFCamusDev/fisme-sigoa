import React, { act } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import type { MyPermissionGrant } from '@sigoa/shared';
import { selectIsAuthenticated, useAuthStore } from '@/stores/auth.store';
import { DEFAULT_TEST_PERMISSIONS } from './msw/handlers';

export interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  initialEntries?: string[];
  withRouter?: boolean;
  permissions?: readonly MyPermissionGrant[] | null;
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

export function renderWithProviders(
  ui: React.ReactElement,
  options: CustomRenderOptions = {},
): RenderResult & { queryClient: QueryClient } {
  const {
    queryClient: customQueryClient,
    initialEntries: customInitialEntries,
    withRouter: customWithRouter,
    permissions,
    ...rtlOptions
  } = options;
  const queryClient = customQueryClient ?? createTestQueryClient();
  const withRouter = customWithRouter ?? true;
  const initialEntries = customInitialEntries ?? ['/'];

  const currentAuth = useAuthStore.getState();
  if (!selectIsAuthenticated(currentAuth) || !currentAuth.user) {
    const fallbackUser = currentAuth.user ?? {
      id: 'usr-test-default',
      names: 'Admin',
      firstSurname: 'Test',
      secondSurname: null,
      email: 'admin.test@untrm.edu.pe',
    };
    useAuthStore.setState({
      accessToken: 'test-access-token',
      accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
      refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      user: fallbackUser,
    });
  }

  const activeUserId = useAuthStore.getState().user?.id;
  if (activeUserId && permissions !== null) {
    const existingData = queryClient.getQueryData(['me', 'permissions', activeUserId]);
    if (!existingData) {
      queryClient.setQueryData(['me', 'permissions', activeUserId], {
        permissions: permissions ?? DEFAULT_TEST_PERMISSIONS,
      });
    }
  }

  if (!withRouter) {
    const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const result = render(ui, { wrapper: Wrapper, ...rtlOptions });
    return { ...result, queryClient };
  }

  const rootRoute = createRootRoute({
    component: () => ui,
  });

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries }),
  });

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  let result!: RenderResult;
  act(() => {
    result = render(<RouterProvider router={router} />, { wrapper: Wrapper, ...rtlOptions });
  });

  return {
    ...result,
    queryClient,
  };
}
