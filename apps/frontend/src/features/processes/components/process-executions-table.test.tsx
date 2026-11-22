import { cleanup, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { SAMPLE_PROCESS_EXECUTION_DTO } from '../test/process-executions-fixtures';
import { ProcessExecutionsTable } from './process-executions-table';

describe('ProcessExecutionsTable (HU-028, T-028-24)', () => {
  it('shows the schedule link only with cronograma.ver', async () => {
    server.use(
      http.get('*/me/permissions', () =>
        HttpResponse.json({ permissions: [{ code: 'ejecucion.ver', scope: 'GLOBAL' }] }),
      ),
    );

    renderWithProviders(<ProcessExecutionsTable items={[SAMPLE_PROCESS_EXECUTION_DTO]} />, {
      permissions: [{ code: 'ejecucion.ver', scope: 'GLOBAL' }],
    });

    await screen.findByText(SAMPLE_PROCESS_EXECUTION_DTO.name);
    expect(screen.queryByRole('link', { name: /Cronograma/i })).not.toBeInTheDocument();

    cleanup();
    const withSchedulePerms = [
      { code: 'ejecucion.ver', scope: 'GLOBAL' as const },
      { code: 'cronograma.ver', scope: 'GLOBAL' as const },
    ];
    server.use(
      http.get('*/me/permissions', () => HttpResponse.json({ permissions: withSchedulePerms })),
    );

    renderWithProviders(<ProcessExecutionsTable items={[SAMPLE_PROCESS_EXECUTION_DTO]} />, {
      permissions: withSchedulePerms,
    });

    const link = await screen.findByRole('link', { name: /Cronograma/i });
    expect(link).toHaveAttribute('href', `/cronograma/${SAMPLE_PROCESS_EXECUTION_DTO.id}`);
  });

  it('shows the board link only with ejecucion.ver', async () => {
    server.use(http.get('*/me/permissions', () => HttpResponse.json({ permissions: [] })));

    renderWithProviders(<ProcessExecutionsTable items={[SAMPLE_PROCESS_EXECUTION_DTO]} />, {
      permissions: [],
    });

    await screen.findByText(SAMPLE_PROCESS_EXECUTION_DTO.name);
    expect(screen.queryByRole('link', { name: /Ver tablero/i })).not.toBeInTheDocument();

    cleanup();
    const withViewPerms = [{ code: 'ejecucion.ver', scope: 'GLOBAL' as const }];
    server.use(
      http.get('*/me/permissions', () => HttpResponse.json({ permissions: withViewPerms })),
    );

    renderWithProviders(<ProcessExecutionsTable items={[SAMPLE_PROCESS_EXECUTION_DTO]} />, {
      permissions: withViewPerms,
    });

    const boardLink = await screen.findByRole('link', { name: /Ver tablero/i });
    expect(boardLink).toHaveAttribute('href', `/ejecuciones/${SAMPLE_PROCESS_EXECUTION_DTO.id}`);
  });
});
