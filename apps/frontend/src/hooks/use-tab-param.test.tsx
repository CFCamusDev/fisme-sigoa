import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { tabSearchSchema } from '@/lib/tab-param';
import { useTabParam } from './use-tab-param';

const TABS = ['vigentes', 'historial', 'definir'] as const;

function TabHarness() {
  const [tab, setTab] = useTabParam(TABS, 'vigentes');
  return (
    <div>
      <span data-testid="active-tab">{tab}</span>
      <button type="button" onClick={() => setTab('historial')}>
        Ir a historial
      </button>
      <button type="button" onClick={() => setTab('definir')}>
        Ir a definir
      </button>
    </div>
  );
}

function createTestRouter(initialEntry: string, withStrictSchema: boolean) {
  const rootRoute = createRootRoute();
  const strictSchema = z.object({ page: z.number().optional() }).merge(tabSearchSchema);
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    validateSearch: withStrictSchema ? (search) => strictSchema.parse(search) : undefined,
    component: TabHarness,
  });

  const routeTree = rootRoute.addChildren([indexRoute]);
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
}

describe('useTabParam', () => {
  it('reads and writes ?tab= replacing the history entry', async () => {
    const user = userEvent.setup();
    const router = createTestRouter('/?tab=definir', false);
    await router.load();

    render(<RouterProvider router={router} />);

    expect(screen.getByTestId('active-tab')).toHaveTextContent('definir');
    const initialHistoryLength = router.history.length;

    await user.click(screen.getByRole('button', { name: 'Ir a historial' }));

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('historial');
    });
    expect(router.state.location.search).toMatchObject({ tab: 'historial' });
    expect(router.history.length).toBe(initialHistoryLength);
  });

  it('keeps working when the route validateSearch strips unknown keys', async () => {
    const user = userEvent.setup();
    const router = createTestRouter('/?tab=desconocida&extra=1', true);
    await router.load();

    render(<RouterProvider router={router} />);

    expect(screen.getByTestId('active-tab')).toHaveTextContent('vigentes');

    await user.click(screen.getByRole('button', { name: 'Ir a definir' }));

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('definir');
    });
    expect(router.state.matches.at(-1)?.search).toEqual({ tab: 'definir' });
  });
});
