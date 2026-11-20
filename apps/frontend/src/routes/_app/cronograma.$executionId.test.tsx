import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { Route } from './cronograma.$executionId';

describe('ScheduleEditorRoute (/cronograma/$executionId) (HU-028, T-028-24)', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuthSession();
  });

  it('redirects without cronograma.ver', async () => {
    const beforeLoad = Route.options.beforeLoad as (() => Promise<unknown>) | undefined;
    expect(typeof beforeLoad).toBe('function');
    await expect(beforeLoad?.()).rejects.toBeDefined();
  });

  it('renders the editor with cronograma.ver', async () => {
    server.use(
      http.get('*/process-executions/exec-1/schedule', () => HttpResponse.json({ items: [] })),
    );

    vi.spyOn(Route, 'useParams').mockReturnValue({ executionId: 'exec-1' });

    const Component = Route.options.component;
    expect(Component).toBeDefined();
    if (Component) {
      renderWithProviders(<Component />, {
        permissions: [{ code: 'cronograma.ver', scope: 'GLOBAL' }],
      });
      expect(
        await screen.findByRole('heading', { level: 1, name: /Cronograma de ejecución/i }),
      ).toBeInTheDocument();
      expect(
        await screen.findByText(/Aún no hay actividades en el cronograma/i),
      ).toBeInTheDocument();
    }
  });
});
