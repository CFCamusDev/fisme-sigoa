import type { ExecutionBoardResponse } from '@sigoa/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { ExecutionBoardPage } from './execution-board-page';

const BOARD_PERMS = [
  { code: 'ejecucion.ver', scope: 'GLOBAL' as const },
  { code: 'cronograma.ver', scope: 'GLOBAL' as const },
];

function buildBoardResponse(
  overrides: Partial<ExecutionBoardResponse> = {},
): ExecutionBoardResponse {
  return {
    execution: {
      id: 'exec-1',
      type: 'P612',
      name: 'Medición anual OE 2027',
      year: 2027,
      semesterId: null,
      semesterCode: null,
      catalogVersionId: 'cv-1',
      catalogVersionNumber: 2,
      status: 'IN_PROGRESS',
      voidReason: null,
      createdAt: '2027-01-10T10:00:00.000Z',
      updatedAt: '2027-01-15T12:00:00.000Z',
    },
    schedule: {
      total: 4,
      completed: 2,
      inProgress: 1,
      pending: 1,
      overdue: 1,
      progressPercent: 50,
    },
    sessions: {
      total: 1,
      lastSessionDate: '2027-03-10',
      items: [
        {
          id: 'sess-1',
          stakeholderType: 'EMPLOYER',
          sessionDate: '2027-03-10',
          startTime: '10:00',
          modality: 'VIRTUAL',
        },
      ],
    },
    surveys: { available: false },
    minutes: { available: false },
    results: { available: false },
    pending: [
      {
        code: 'SCHEDULE_HAS_ACTIVITY',
        label: 'El cronograma tiene al menos una actividad registrada',
        state: 'UNMET',
        target: 'SCHEDULE',
      },
      {
        code: 'SESSIONS_MINUTES_SIGNED',
        label: 'Las actas de las sesiones están firmadas',
        state: 'NOT_VERIFIABLE',
        target: 'MINUTES',
      },
      {
        code: 'RESULTS_CALCULATED',
        label: 'Los resultados del proceso han sido calculados',
        state: 'NOT_VERIFIABLE',
        target: 'RESULTS',
      },
    ],
    nextStatus: 'CONSOLIDATING',
    generatedAt: '2027-03-15T10:00:00.000Z',
    ...overrides,
  };
}

describe('ExecutionBoardPage (HU-031, T-031-09)', () => {
  beforeEach(() => {
    server.use(http.get('*/me/permissions', () => HttpResponse.json({ permissions: BOARD_PERMS })));
  });

  it('shows the status, the schedule progress and every section', async () => {
    server.use(
      http.get('*/process-executions/exec-1/board', () => HttpResponse.json(buildBoardResponse())),
    );

    renderWithProviders(<ExecutionBoardPage executionId="exec-1" />, { permissions: BOARD_PERMS });

    expect(
      await screen.findByRole('heading', { name: 'Medición anual OE 2027' }),
    ).toBeInTheDocument();
    expect(screen.getByText('En ejecución')).toBeInTheDocument();

    const progress = screen.getByRole('progressbar', { name: /Avance del cronograma/i });
    expect(progress).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('50%')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Cronograma' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sesiones' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Encuestas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Actas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Resultados' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pendientes' })).toBeInTheDocument();
    expect(screen.getByText(/Empleadores/i)).toBeInTheDocument();
  });

  it('shows unavailable sections as not available yet', async () => {
    server.use(
      http.get('*/process-executions/exec-1/board', () => HttpResponse.json(buildBoardResponse())),
    );

    renderWithProviders(<ExecutionBoardPage executionId="exec-1" />, { permissions: BOARD_PERMS });

    const badges = await screen.findAllByText('Aún no disponible');
    expect(badges).toHaveLength(3);
  });

  it('links each pending item to its section', async () => {
    server.use(
      http.get('*/process-executions/exec-1/board', () => HttpResponse.json(buildBoardResponse())),
    );

    renderWithProviders(<ExecutionBoardPage executionId="exec-1" />, { permissions: BOARD_PERMS });

    const scheduleLink = await screen.findByRole('link', { name: /Ir al cronograma/i });
    expect(scheduleLink).toHaveAttribute('href', '/cronograma/exec-1');

    const sessionsLinks = screen.getAllByRole('link', { name: /Ir a sesiones/i });
    expect(sessionsLinks.some((el) => el.getAttribute('href') === '/sesiones')).toBe(true);

    expect(screen.getByText('Sin pantalla disponible todavía')).toBeInTheDocument();
  });

  it('shows the empty state when nothing is pending', async () => {
    server.use(
      http.get('*/process-executions/exec-1/board', () =>
        HttpResponse.json(buildBoardResponse({ pending: [], nextStatus: null })),
      ),
    );

    renderWithProviders(<ExecutionBoardPage executionId="exec-1" />, { permissions: BOARD_PERMS });

    expect(
      await screen.findByText('No hay pendientes: la ejecución cumple todo lo requerido'),
    ).toBeInTheDocument();
  });

  it('shows the loading state', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    server.use(
      http.get('*/process-executions/exec-1/board', async () => {
        await gate;
        return HttpResponse.json(buildBoardResponse());
      }),
    );

    renderWithProviders(<ExecutionBoardPage executionId="exec-1" />, { permissions: BOARD_PERMS });

    expect(await screen.findByRole('status')).toHaveTextContent(
      /Cargando tablero de la ejecución/i,
    );

    release();
    expect(
      await screen.findByRole('heading', { name: 'Medición anual OE 2027' }),
    ).toBeInTheDocument();
  });

  it('shows an error with a retry button', async () => {
    const user = userEvent.setup();
    let shouldFail = true;

    server.use(
      http.get('*/process-executions/exec-1/board', () => {
        if (shouldFail) {
          return HttpResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Error interno' } },
            { status: 500 },
          );
        }
        return HttpResponse.json(buildBoardResponse());
      }),
    );

    renderWithProviders(<ExecutionBoardPage executionId="exec-1" />, { permissions: BOARD_PERMS });

    expect(await screen.findByText('No se pudo cargar el tablero')).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: /Reintentar/i });

    shouldFail = false;
    await user.click(retryButton);

    expect(
      await screen.findByRole('heading', { name: 'Medición anual OE 2027' }),
    ).toBeInTheDocument();
  });

  it('shows the not found message', async () => {
    server.use(
      http.get('*/process-executions/missing-id/board', () =>
        HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Ejecución no encontrada' } },
          { status: 404 },
        ),
      ),
    );

    renderWithProviders(<ExecutionBoardPage executionId="missing-id" />, {
      permissions: BOARD_PERMS,
    });

    expect(await screen.findByText('No se encontró la ejecución solicitada.')).toBeInTheDocument();
  });
});
