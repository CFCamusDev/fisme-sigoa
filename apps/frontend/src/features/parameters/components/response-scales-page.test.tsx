import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import {
  buildEvidenceScale,
  buildLikertScale,
  buildResponseScalesResponse,
} from '@/test/response-scale-fixtures';
import { ResponseScalesPage } from './response-scales-page';

const BASE = 'http://localhost:3000/response-scales';
const readOnly = [{ code: 'parametro.ver', scope: 'GLOBAL' as const }];

describe('ResponseScalesPage Component (HU-012, T-012-17, CA1, CA2, CA3)', () => {
  it('renders the loading state while the scales are fetching', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(BASE, async () => {
        await gate;
        return HttpResponse.json(buildResponseScalesResponse());
      }),
    );

    renderWithProviders(<ResponseScalesPage />, { withRouter: false });

    expect(screen.getAllByText(/cargando escalas/i).length).toBeGreaterThan(0);
    release();
    expect(
      await screen.findByRole('table', { name: 'Niveles de Evidencia en el desempeño (4)' }),
    ).toBeInTheDocument();
  });

  it('shows the three scales with their levels', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(buildResponseScalesResponse())));

    renderWithProviders(<ResponseScalesPage />, { withRouter: false });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Escalas de respuesta' }),
    ).toBeInTheDocument();
    const headings = await screen.findAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual([
      'Likert de acuerdo (5)',
      'Numérica 1–5',
      'Evidencia en el desempeño (4)',
    ]);
    const likert = screen.getByRole('table', { name: 'Niveles de Likert de acuerdo (5)' });
    expect(within(likert).getAllByRole('row')).toHaveLength(6);
    expect(within(likert).getByText('Completamente en desacuerdo')).toBeInTheDocument();
    const evidence = screen.getByRole('table', {
      name: 'Niveles de Evidencia en el desempeño (4)',
    });
    expect(within(evidence).getAllByRole('row')).toHaveLength(5);
  });

  it('shows which levels count as achievement', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(buildResponseScalesResponse())));

    renderWithProviders(<ResponseScalesPage />, { withRouter: false });

    const evidence = await screen.findByRole('table', {
      name: 'Niveles de Evidencia en el desempeño (4)',
    });
    const rows = within(evidence).getAllByRole('row').slice(1);
    expect(within(rows[0]!).getByText('Cuenta como logro')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Cuenta como logro')).toBeInTheDocument();
    expect(within(rows[2]!).queryByText('Cuenta como logro')).not.toBeInTheDocument();
    expect(within(rows[2]!).getByText('No cuenta')).toBeInTheDocument();
    expect(within(rows[3]!).getByText('No cuenta')).toBeInTheDocument();
  });

  it('marks an in-use scale and tells to duplicate it', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json(
          buildResponseScalesResponse([buildLikertScale(), buildEvidenceScale({ inUse: true })]),
        ),
      ),
    );

    renderWithProviders(<ResponseScalesPage />, { withRouter: false });

    expect(await screen.findByText('En uso')).toBeInTheDocument();
    expect(
      screen.getAllByText(/no se puede modificar\. Duplícala para crear una nueva/i),
    ).toHaveLength(1);
  });

  it('shows the read-only notice when the user cannot edit', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(buildResponseScalesResponse())));

    renderWithProviders(<ResponseScalesPage />, { withRouter: false, permissions: readOnly });

    expect(await screen.findByText(/solo lectura/i)).toBeInTheDocument();
  });

  it('renders the access denied state on 403', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Sin permiso' } },
          { status: 403 },
        ),
      ),
    );

    renderWithProviders(<ResponseScalesPage />, { withRouter: false });

    expect(
      await screen.findByText(/no tienes permiso para consultar las escalas/i),
    ).toBeInTheDocument();
  });

  it('renders a generic error on 500 and recovers with the retry button', async () => {
    let calls = 0;
    server.use(
      http.get(BASE, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              { error: { code: 'INTERNAL_ERROR', message: 'Fallo' } },
              { status: 500 },
            )
          : HttpResponse.json(buildResponseScalesResponse());
      }),
    );
    const user = userEvent.setup();

    renderWithProviders(<ResponseScalesPage />, { withRouter: false });

    expect(await screen.findByText(/error al cargar las escalas/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(
      await screen.findByRole('table', { name: 'Niveles de Evidencia en el desempeño (4)' }),
    ).toBeInTheDocument();
  });

  it('renders the empty state when there are no scales', async () => {
    server.use(http.get(BASE, () => HttpResponse.json({ items: [] })));

    renderWithProviders(<ResponseScalesPage />, { withRouter: false });

    expect(await screen.findByText(/no hay escalas configuradas/i)).toBeInTheDocument();
  });
});
