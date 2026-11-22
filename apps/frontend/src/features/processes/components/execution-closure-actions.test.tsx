import { StrictMode } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { ExecutionClosureActions } from './execution-closure-actions';
import { ExecutionStatusBar } from './execution-status-bar';

const ALL_CLOSURE_PERMS = [
  { code: 'ejecucion.ver', scope: 'GLOBAL' as const },
  { code: 'ejecucion.cerrar', scope: 'GLOBAL' as const },
  { code: 'ejecucion.anular', scope: 'GLOBAL' as const },
];

const VOID_ONLY_PERMS = [
  { code: 'ejecucion.ver', scope: 'GLOBAL' as const },
  { code: 'ejecucion.anular', scope: 'GLOBAL' as const },
];

const CLOSE_ONLY_PERMS = [
  { code: 'ejecucion.ver', scope: 'GLOBAL' as const },
  { code: 'ejecucion.cerrar', scope: 'GLOBAL' as const },
];

describe('ExecutionClosureActions (HU-030, T-030-16)', () => {
  it('closes the execution after confirming', async () => {
    const user = userEvent.setup();
    let closed = false;

    server.use(
      http.get('*/process-executions/exec-1/next-transition', () =>
        HttpResponse.json({
          executionId: 'exec-1',
          status: closed ? 'CLOSED' : 'PENDING_APPROVAL',
          nextStatus: null,
          preconditions: [],
          canAdvance: false,
        }),
      ),
      http.post('*/process-executions/exec-1/close', () => {
        closed = true;
        return HttpResponse.json({
          executionId: 'exec-1',
          previousStatus: 'PENDING_APPROVAL',
          status: 'CLOSED',
          updatedAt: '2027-03-01T10:00:00.000Z',
        });
      }),
    );

    renderWithProviders(<ExecutionStatusBar executionId="exec-1" />, {
      permissions: ALL_CLOSURE_PERMS,
    });

    const trigger = await screen.findByRole('button', { name: /Cerrar ejecución/i });
    await user.click(trigger);

    const confirmBtn = screen.getByRole('button', { name: /Confirmar cierre/i });
    await user.click(confirmBtn);

    await waitFor(() => expect(closed).toBe(true));
    expect(
      await screen.findByText(/La ejecución está Cerrada y es de solo lectura/i),
    ).toBeInTheDocument();
  });

  it('lists the unmet preconditions returned by the server on close', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('*/process-executions/exec-1/close', () =>
        HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'No se puede cerrar la ejecución porque faltan precondiciones',
              details: [
                {
                  path: 'RESOLUTION_APPROVED',
                  message: 'La resolución que aprueba el proceso está aprobada con su PDF',
                },
              ],
            },
          },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(
      <ExecutionClosureActions executionId="exec-1" status="PENDING_APPROVAL" />,
      { permissions: ALL_CLOSURE_PERMS },
    );

    await user.click(screen.getByRole('button', { name: /Cerrar ejecución/i }));
    await user.click(screen.getByRole('button', { name: /Confirmar cierre/i }));

    expect(
      await screen.findByText('La resolución que aprueba el proceso está aprobada con su PDF'),
    ).toBeInTheDocument();
  });

  it('requires a reason before voiding', async () => {
    const user = userEvent.setup();
    let postCalls = 0;

    server.use(
      http.post('*/process-executions/exec-1/void', () => {
        postCalls += 1;
        return HttpResponse.json({});
      }),
    );

    renderWithProviders(<ExecutionClosureActions executionId="exec-1" status="IN_PROGRESS" />, {
      permissions: ALL_CLOSURE_PERMS,
    });

    await user.click(screen.getByRole('button', { name: /Anular ejecución/i }));
    await user.click(screen.getByRole('button', { name: /Confirmar anulación/i }));

    expect(await screen.findByText(/Ingresa el motivo de anulación/i)).toBeInTheDocument();
    expect(postCalls).toBe(0);
  });

  it('voids the execution with the reason', async () => {
    const user = userEvent.setup();
    let receivedBody: unknown = null;

    server.use(
      http.post('*/process-executions/exec-1/void', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({
          executionId: 'exec-1',
          previousStatus: 'IN_PROGRESS',
          status: 'VOIDED',
          voidReason: 'Ejecución duplicada por error',
          updatedAt: '2027-03-01T10:00:00.000Z',
        });
      }),
    );

    renderWithProviders(<ExecutionClosureActions executionId="exec-1" status="IN_PROGRESS" />, {
      permissions: ALL_CLOSURE_PERMS,
    });

    await user.click(screen.getByRole('button', { name: /Anular ejecución/i }));
    await user.type(
      screen.getByLabelText(/Motivo de anulación/i),
      '  Ejecución duplicada por error  ',
    );
    await user.click(screen.getByRole('button', { name: /Confirmar anulación/i }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(receivedBody).toEqual({ reason: 'Ejecución duplicada por error' });
  });

  it('hides the close button without ejecucion.cerrar and outside pending approval', () => {
    const { rerender } = renderWithProviders(
      <ExecutionClosureActions executionId="exec-1" status="PENDING_APPROVAL" />,
      { permissions: VOID_ONLY_PERMS },
    );
    expect(screen.queryByRole('button', { name: /Cerrar ejecución/i })).not.toBeInTheDocument();

    rerender(<ExecutionClosureActions executionId="exec-1" status="IN_PROGRESS" />);
    expect(screen.queryByRole('button', { name: /Cerrar ejecución/i })).not.toBeInTheDocument();
  });

  it('hides the void button without ejecucion.anular and on a closed or voided execution', () => {
    const { rerender } = renderWithProviders(
      <ExecutionClosureActions executionId="exec-1" status="IN_PROGRESS" />,
      { permissions: CLOSE_ONLY_PERMS },
    );
    expect(screen.queryByRole('button', { name: /Anular ejecución/i })).not.toBeInTheDocument();

    rerender(<ExecutionClosureActions executionId="exec-1" status="CLOSED" />);
    expect(screen.queryByRole('button', { name: /Anular ejecución/i })).not.toBeInTheDocument();

    rerender(<ExecutionClosureActions executionId="exec-1" status="VOIDED" />);
    expect(screen.queryByRole('button', { name: /Anular ejecución/i })).not.toBeInTheDocument();
  });

  it('shows the read-only message for a closed execution', async () => {
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

    renderWithProviders(<ExecutionStatusBar executionId="exec-1" />, {
      permissions: ALL_CLOSURE_PERMS,
    });

    expect(
      await screen.findByText(/La ejecución está Cerrada y es de solo lectura/i),
    ).toBeInTheDocument();
  });

  it('blocks the buttons while the request is in flight', async () => {
    const user = userEvent.setup();
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });

    server.use(
      http.post('*/process-executions/exec-1/close', async () => {
        await gate;
        return HttpResponse.json({
          executionId: 'exec-1',
          previousStatus: 'PENDING_APPROVAL',
          status: 'CLOSED',
          updatedAt: '2027-03-01T10:00:00.000Z',
        });
      }),
    );

    renderWithProviders(
      <StrictMode>
        <ExecutionClosureActions executionId="exec-1" status="PENDING_APPROVAL" />
      </StrictMode>,
      { permissions: ALL_CLOSURE_PERMS },
    );

    await user.click(screen.getByRole('button', { name: /Cerrar ejecución/i }));
    await user.click(screen.getByRole('button', { name: /Confirmar cierre/i }));

    expect(await screen.findByRole('button', { name: /Cerrando/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Cancelar/i })).toBeDisabled();

    releaseGate();

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('returns focus to the trigger when cancelling', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <ExecutionClosureActions executionId="exec-1" status="PENDING_APPROVAL" />,
      { permissions: ALL_CLOSURE_PERMS },
    );

    const closeTrigger = screen.getByRole('button', { name: /Cerrar ejecución/i });
    await user.click(closeTrigger);
    expect(screen.getByRole('button', { name: /Cancelar/i })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(closeTrigger).toHaveFocus();
  });

  it('shows the error returned by the server', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('*/process-executions/exec-1/void', () =>
        HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'La ejecución ya fue cerrada por otro usuario',
            },
          },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(<ExecutionClosureActions executionId="exec-1" status="IN_PROGRESS" />, {
      permissions: ALL_CLOSURE_PERMS,
    });

    await user.click(screen.getByRole('button', { name: /Anular ejecución/i }));
    await user.type(screen.getByLabelText(/Motivo de anulación/i), 'Motivo válido');
    await user.click(screen.getByRole('button', { name: /Confirmar anulación/i }));

    expect(
      await screen.findByText(/La ejecución ya fue cerrada por otro usuario/i),
    ).toBeInTheDocument();
  });
});
