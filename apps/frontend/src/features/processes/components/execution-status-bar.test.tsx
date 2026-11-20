import { StrictMode } from 'react';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { ExecutionStatusBar } from './execution-status-bar';

const ALL_PERMS = [
  { code: 'ejecucion.ver', scope: 'GLOBAL' as const },
  { code: 'ejecucion.avanzar', scope: 'GLOBAL' as const },
];

const VIEW_ONLY_PERMS = [{ code: 'ejecucion.ver', scope: 'GLOBAL' as const }];

const SAMPLE_PLANNED = {
  executionId: 'exec-1',
  status: 'PLANNED',
  nextStatus: 'IN_PROGRESS',
  preconditions: [
    {
      code: 'SCHEDULE_HAS_ACTIVITY',
      label: 'El cronograma tiene al menos una actividad registrada',
      state: 'MET',
    },
  ],
  canAdvance: true,
};

const SAMPLE_IN_PROGRESS = {
  executionId: 'exec-1',
  status: 'IN_PROGRESS',
  nextStatus: 'CONSOLIDATING',
  preconditions: [
    {
      code: 'SESSIONS_SURVEYS_CLOSED',
      label: 'Todas las encuestas de las sesiones están cerradas',
      state: 'NOT_VERIFIABLE',
    },
    {
      code: 'SESSIONS_MINUTES_SIGNED',
      label: 'Las actas de las sesiones están firmadas',
      state: 'UNMET',
    },
  ],
  canAdvance: false,
};

describe('ExecutionStatusBar (HU-029, T-029-11)', () => {
  it('shows the loading, error and terminal states', async () => {
    server.use(
      http.get('*/process-executions/exec-1/next-transition', async () => {
        await delay(40);
        return HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Fallo al consultar el estado' } },
          { status: 500 },
        );
      }),
    );

    renderWithProviders(<ExecutionStatusBar executionId="exec-1" />, { permissions: ALL_PERMS });

    expect(await screen.findByText(/Cargando estado de la ejecución/i)).toBeInTheDocument();
    expect(await screen.findByText(/Fallo al consultar el estado/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument();

    cleanup();
    server.use(
      http.get('*/process-executions/exec-1/next-transition', () =>
        HttpResponse.json({
          executionId: 'exec-1',
          status: 'CLOSED',
          nextStatus: null,
          preconditions: [],
          canAdvance: false,
        }),
      ),
    );

    renderWithProviders(<ExecutionStatusBar executionId="exec-1" />, { permissions: ALL_PERMS });

    expect(
      await screen.findByText(/Esta ejecución no tiene transiciones de avance pendientes/i),
    ).toBeInTheDocument();
  });

  it('shows the current status with icon and text', async () => {
    server.use(
      http.get('*/process-executions/exec-1/next-transition', () =>
        HttpResponse.json(SAMPLE_PLANNED),
      ),
    );

    renderWithProviders(<ExecutionStatusBar executionId="exec-1" />, { permissions: ALL_PERMS });

    expect(await screen.findByText(/Estado actual:/i)).toBeInTheDocument();
    const currentStep = screen.getByText('Planificado', { selector: 'li span' });
    expect(currentStep.closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getAllByText('Planificado').length).toBeGreaterThanOrEqual(2);
  });

  it('advances the execution and shows the new status', async () => {
    const user = userEvent.setup();
    let current = SAMPLE_PLANNED;

    server.use(
      http.get('*/process-executions/exec-1/next-transition', () => HttpResponse.json(current)),
      http.post('*/process-executions/exec-1/advance', () => {
        current = SAMPLE_IN_PROGRESS;
        return HttpResponse.json({
          executionId: 'exec-1',
          previousStatus: 'PLANNED',
          status: 'IN_PROGRESS',
          updatedAt: '2027-03-01T10:00:00.000Z',
        });
      }),
    );

    renderWithProviders(<ExecutionStatusBar executionId="exec-1" />, { permissions: ALL_PERMS });

    const button = await screen.findByRole('button', { name: /Avanzar a En ejecución/i });
    await user.click(button);

    await waitFor(() => {
      const activeStep = screen.getByText('En ejecución', { selector: 'li span' });
      expect(activeStep.closest('li')).toHaveAttribute('aria-current', 'step');
    });
  });

  it('lists the unmet preconditions returned by the server', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/process-executions/exec-1/next-transition', () =>
        HttpResponse.json(SAMPLE_PLANNED),
      ),
      http.post('*/process-executions/exec-1/advance', () =>
        HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'No se puede avanzar la ejecución porque faltan precondiciones por cumplir',
              details: [
                {
                  path: 'SESSIONS_MINUTES_SIGNED',
                  message: 'Las actas de las sesiones están firmadas',
                },
              ],
            },
          },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(<ExecutionStatusBar executionId="exec-1" />, { permissions: ALL_PERMS });

    const button = await screen.findByRole('button', { name: /Avanzar a En ejecución/i });
    await user.click(button);

    expect(await screen.findByText('Las actas de las sesiones están firmadas')).toBeInTheDocument();
  });

  it('shows not verifiable preconditions as pending with text', async () => {
    server.use(
      http.get('*/process-executions/exec-1/next-transition', () =>
        HttpResponse.json(SAMPLE_IN_PROGRESS),
      ),
    );

    renderWithProviders(<ExecutionStatusBar executionId="exec-1" />, { permissions: ALL_PERMS });

    expect(
      await screen.findByText('Todas las encuestas de las sesiones están cerradas'),
    ).toBeInTheDocument();
    expect(screen.getByText('No verificable')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });

  it('hides the advance button without ejecucion.avanzar', async () => {
    server.use(
      http.get('*/process-executions/exec-1/next-transition', () =>
        HttpResponse.json(SAMPLE_PLANNED),
      ),
    );

    renderWithProviders(<ExecutionStatusBar executionId="exec-1" />, {
      permissions: VIEW_ONLY_PERMS,
    });

    expect(
      await screen.findByText('El cronograma tiene al menos una actividad registrada'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Avanzar/i })).not.toBeInTheDocument();
  });

  it('disables the button while a request is in flight', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/process-executions/exec-1/next-transition', () =>
        HttpResponse.json(SAMPLE_PLANNED),
      ),
      http.post('*/process-executions/exec-1/advance', async () => {
        await delay(50);
        return HttpResponse.json({
          executionId: 'exec-1',
          previousStatus: 'PLANNED',
          status: 'IN_PROGRESS',
          updatedAt: '2027-03-01T10:00:00.000Z',
        });
      }),
    );

    renderWithProviders(<ExecutionStatusBar executionId="exec-1" />, { permissions: ALL_PERMS });

    const button = await screen.findByRole('button', { name: /Avanzar a En ejecución/i });
    const clickPromise = user.click(button);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Avanzando/i })).toBeDisabled();
    });
    await clickPromise;
  });

  it('requests the next transition once under StrictMode', async () => {
    let calls = 0;
    server.use(
      http.get('*/process-executions/exec-1/next-transition', () => {
        calls += 1;
        return HttpResponse.json(SAMPLE_PLANNED);
      }),
    );

    renderWithProviders(
      <StrictMode>
        <ExecutionStatusBar executionId="exec-1" />
      </StrictMode>,
      { permissions: ALL_PERMS },
    );

    expect(await screen.findByRole('button', { name: /Avanzar a En ejecución/i })).toBeEnabled();
    expect(calls).toBe(1);
  });

  it('is operable with the keyboard', async () => {
    const user = userEvent.setup();
    let advanced = false;
    server.use(
      http.get('*/process-executions/exec-1/next-transition', () =>
        HttpResponse.json(advanced ? SAMPLE_IN_PROGRESS : SAMPLE_PLANNED),
      ),
      http.post('*/process-executions/exec-1/advance', () => {
        advanced = true;
        return HttpResponse.json({
          executionId: 'exec-1',
          previousStatus: 'PLANNED',
          status: 'IN_PROGRESS',
          updatedAt: '2027-03-01T10:00:00.000Z',
        });
      }),
    );

    renderWithProviders(<ExecutionStatusBar executionId="exec-1" />, { permissions: ALL_PERMS });

    const button = await screen.findByRole('button', { name: /Avanzar a En ejecución/i });
    button.focus();
    expect(button).toHaveFocus();

    await user.keyboard('{Enter}');

    await waitFor(() => expect(advanced).toBe(true));
  });
});
