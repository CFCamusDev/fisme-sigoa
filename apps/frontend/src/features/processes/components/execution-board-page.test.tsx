import type { ExecutionBoardResponse } from '@sigoa/shared';
import { screen, waitFor } from '@testing-library/react';
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
    const voidPermissions = [
      ...BOARD_PERMS,
      { code: 'ejecucion.anular', scope: 'GLOBAL' as const },
    ];
    server.use(
      http.get('*/me/permissions', () => HttpResponse.json({ permissions: voidPermissions })),
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
    const voidPermissions = [
      ...BOARD_PERMS,
      { code: 'ejecucion.anular', scope: 'GLOBAL' as const },
    ];
    server.use(
      http.get('*/me/permissions', () => HttpResponse.json({ permissions: voidPermissions })),
      http.get('*/process-executions/exec-1/board', () => HttpResponse.json(buildBoardResponse())),
    );

    renderWithProviders(<ExecutionBoardPage executionId="exec-1" />, { permissions: BOARD_PERMS });

    const badges = await screen.findAllByText('Aún no disponible');
    expect(badges).toHaveLength(3);
  });

  it('links each pending item to its section', async () => {
    const voidPermissions = [
      ...BOARD_PERMS,
      { code: 'ejecucion.anular', scope: 'GLOBAL' as const },
    ];
    server.use(
      http.get('*/me/permissions', () => HttpResponse.json({ permissions: voidPermissions })),
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

  it('offers void from the board and shows the reason when voided', async () => {
    const user = userEvent.setup();
    let voided = false;
    const voidReason = 'Ejecución duplicada por error de registro';

    const voidPermissions = [
      ...BOARD_PERMS,
      { code: 'ejecucion.anular', scope: 'GLOBAL' as const },
    ];
    server.use(
      http.get('*/me/permissions', () => HttpResponse.json({ permissions: voidPermissions })),
      http.get('*/process-executions/exec-1/board', () => {
        const base = buildBoardResponse();
        return HttpResponse.json({
          ...base,
          execution: {
            ...base.execution,
            status: voided ? 'VOIDED' : 'IN_PROGRESS',
            voidReason: voided ? voidReason : null,
          },
        });
      }),
      http.post('*/process-executions/exec-1/void', () => {
        voided = true;
        return HttpResponse.json({
          executionId: 'exec-1',
          previousStatus: 'IN_PROGRESS',
          status: 'VOIDED',
          voidReason,
          updatedAt: '2027-01-16T10:00:00.000Z',
        });
      }),
    );

    renderWithProviders(<ExecutionBoardPage executionId="exec-1" />, {
      permissions: [...BOARD_PERMS, { code: 'ejecucion.anular', scope: 'GLOBAL' as const }],
    });

    const voidButton = await screen.findByRole('button', { name: /Anular ejecución/i });
    await user.click(voidButton);

    await user.type(screen.getByLabelText(/Motivo de anulación/i), voidReason);
    await user.click(screen.getByRole('button', { name: /Confirmar anulación/i }));

    expect(await screen.findByText(`Motivo de anulación: ${voidReason}`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Anular ejecución/i })).not.toBeInTheDocument();
  });

  it('sends a single void request on double click', async () => {
    const user = userEvent.setup();
    let postCalls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const voidReason = 'Ejecución duplicada por error de registro';

    const voidPermissions = [
      ...BOARD_PERMS,
      { code: 'ejecucion.anular', scope: 'GLOBAL' as const },
    ];
    server.use(
      http.get('*/me/permissions', () => HttpResponse.json({ permissions: voidPermissions })),
      http.get('*/process-executions/exec-1/board', () => HttpResponse.json(buildBoardResponse())),
      http.post('*/process-executions/exec-1/void', async () => {
        postCalls += 1;
        await gate;
        return HttpResponse.json({
          executionId: 'exec-1',
          previousStatus: 'IN_PROGRESS',
          status: 'VOIDED',
          voidReason,
          updatedAt: '2027-01-16T10:00:00.000Z',
        });
      }),
    );

    renderWithProviders(<ExecutionBoardPage executionId="exec-1" />, {
      permissions: [...BOARD_PERMS, { code: 'ejecucion.anular', scope: 'GLOBAL' as const }],
    });

    await user.click(await screen.findByRole('button', { name: /Anular ejecución/i }));
    await user.type(screen.getByLabelText(/Motivo de anulación/i), voidReason);

    const confirmBtn = screen.getByRole('button', { name: /Confirmar anulación/i });
    await user.dblClick(confirmBtn);

    expect(await screen.findByRole('button', { name: /Anulando/i })).toBeDisabled();
    expect(postCalls).toBe(1);

    release();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
