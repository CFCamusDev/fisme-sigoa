import { StrictMode } from 'react';
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
const editor = [
  { code: 'parametro.ver', scope: 'GLOBAL' as const },
  { code: 'parametro.editar', scope: 'GLOBAL' as const },
];

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
      await screen.findByRole('heading', { level: 2, name: 'Evidencia en el desempeño (4)' }),
    ).toBeInTheDocument();
  });

  it('shows the three scales with their levels when expanded', async () => {
    const user = userEvent.setup();
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
    const likertRegion = screen.getByRole('region', { name: 'Likert de acuerdo (5)' });
    await user.click(within(likertRegion).getByRole('button', { name: 'Ver niveles' }));
    const likert = within(likertRegion).getByRole('table', {
      name: 'Niveles de Likert de acuerdo (5)',
    });
    expect(within(likert).getAllByRole('row')).toHaveLength(6);
    expect(within(likert).getByText('Completamente en desacuerdo')).toBeInTheDocument();

    const evidenceRegion = screen.getByRole('region', { name: 'Evidencia en el desempeño (4)' });
    await user.click(within(evidenceRegion).getByRole('button', { name: 'Ver niveles' }));
    const evidence = within(evidenceRegion).getByRole('table', {
      name: 'Niveles de Evidencia en el desempeño (4)',
    });
    expect(within(evidence).getAllByRole('row')).toHaveLength(5);
  });

  it('explains that only Evidencia 4 counts as achievement by default', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(buildResponseScalesResponse())));

    renderWithProviders(<ResponseScalesPage />, { withRouter: false });

    expect(
      await screen.findByText(
        /Solo Evidencia 4 cuenta como logro por defecto; en una copia de la escala se pueden marcar otros niveles/i,
      ),
    ).toBeInTheDocument();
  });

  it('shows which levels count as achievement', async () => {
    const user = userEvent.setup();
    server.use(http.get(BASE, () => HttpResponse.json(buildResponseScalesResponse())));

    renderWithProviders(<ResponseScalesPage />, { withRouter: false });

    const evidenceRegion = await screen.findByRole('region', {
      name: 'Evidencia en el desempeño (4)',
    });
    await user.click(within(evidenceRegion).getByRole('button', { name: 'Ver niveles' }));
    const evidence = within(evidenceRegion).getByRole('table', {
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
      await screen.findByRole('heading', { level: 2, name: 'Evidencia en el desempeño (4)' }),
    ).toBeInTheDocument();
  });

  it('renders the empty state when there are no scales', async () => {
    server.use(http.get(BASE, () => HttpResponse.json({ items: [] })));

    renderWithProviders(<ResponseScalesPage />, { withRouter: false });

    expect(await screen.findByText(/no hay escalas configuradas/i)).toBeInTheDocument();
  });

  it('requests the list once under StrictMode', async () => {
    let calls = 0;
    server.use(
      http.get(BASE, async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return HttpResponse.json(buildResponseScalesResponse());
      }),
    );

    renderWithProviders(
      <StrictMode>
        <ResponseScalesPage />
      </StrictMode>,
      { withRouter: false },
    );

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Evidencia en el desempeño (4)' }),
    ).toBeInTheDocument();
    expect(calls).toBe(1);
  });

  it('offers to duplicate an in-use scale instead of editing it', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json(
          buildResponseScalesResponse([buildLikertScale(), buildEvidenceScale({ inUse: true })]),
        ),
      ),
    );

    renderWithProviders(<ResponseScalesPage />, { withRouter: false, permissions: editor });

    const inUse = await screen.findByRole('region', { name: 'Evidencia en el desempeño (4)' });
    expect(within(inUse).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(within(inUse).getByRole('button', { name: 'Duplicar' })).toBeInTheDocument();
    const free = screen.getByRole('region', { name: 'Likert de acuerdo (5)' });
    expect(within(free).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });

  it('hides the create button and every action for a read-only user', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(buildResponseScalesResponse())));

    renderWithProviders(<ResponseScalesPage />, { withRouter: false, permissions: readOnly });

    await screen.findByText(/solo lectura/i);
    expect(screen.queryByRole('button', { name: 'Nueva escala' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duplicar' })).not.toBeInTheDocument();
  });

  it('creates a scale from the panel, reloads the list, closes the panel and returns the focus', async () => {
    let scales = [buildLikertScale()];
    server.use(
      http.get(BASE, () => HttpResponse.json(buildResponseScalesResponse(scales))),
      http.post(BASE, () => {
        scales = [
          ...scales,
          buildEvidenceScale({ id: 'new-1', code: 'MI_ESCALA', name: 'Mi escala' }),
        ];
        return HttpResponse.json(scales[1], { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ResponseScalesPage />, { withRouter: false, permissions: editor });

    const open = await screen.findByRole('button', { name: 'Nueva escala' });
    await user.click(open);
    expect(screen.getByRole('heading', { level: 2, name: 'Nueva escala' })).toHaveFocus();
    await user.type(screen.getByLabelText('Código'), 'MI_ESCALA');
    await user.type(screen.getByLabelText('Nombre'), 'Mi escala');
    await user.type(screen.getByLabelText('Etiqueta del nivel 1'), 'Bajo');
    await user.type(screen.getByLabelText('Etiqueta del nivel 2'), 'Alto');
    await user.clear(screen.getByLabelText('Valor del nivel 2'));
    await user.type(screen.getByLabelText('Valor del nivel 2'), '2');
    await user.click(screen.getByRole('button', { name: 'Guardar escala' }));

    expect(await screen.findByText('Escala creada.')).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Mi escala' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Nueva escala' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva escala' })).toHaveFocus();
  });

  it('cancels the panel and returns the focus to the button that opened it', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(buildResponseScalesResponse())));
    const user = userEvent.setup();
    renderWithProviders(<ResponseScalesPage />, { withRouter: false, permissions: editor });

    const card = await screen.findByRole('region', { name: 'Likert de acuerdo (5)' });
    const edit = within(card).getByRole('button', { name: 'Editar' });
    await user.click(edit);
    expect(screen.getByRole('heading', { level: 2, name: 'Editar escala' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(
      screen.queryByRole('heading', { level: 2, name: 'Editar escala' }),
    ).not.toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Editar' })).toHaveFocus();
  });

  it('edits a scale from the panel and shows the new name after reloading', async () => {
    let name = 'Likert de acuerdo (5)';
    server.use(
      http.get(BASE, () =>
        HttpResponse.json(buildResponseScalesResponse([buildLikertScale({ name })])),
      ),
      http.patch(`${BASE}/:id`, async ({ request }) => {
        name = ((await request.json()) as { name: string }).name;
        return HttpResponse.json(buildLikertScale({ name }));
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ResponseScalesPage />, { withRouter: false, permissions: editor });

    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    await user.clear(screen.getByLabelText('Nombre'));
    await user.type(screen.getByLabelText('Nombre'), 'Likert renombrada');
    await user.click(screen.getByRole('button', { name: 'Guardar escala' }));

    expect(await screen.findByText('Escala actualizada.')).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Likert renombrada' })).toBeInTheDocument();
  });

  it('duplicates an in-use scale and shows the new editable copy (CA3)', async () => {
    let scales = [buildEvidenceScale({ inUse: true })];
    server.use(
      http.get(BASE, () => HttpResponse.json(buildResponseScalesResponse(scales))),
      http.post(`${BASE}/:id/duplicate`, async ({ request }) => {
        const body = (await request.json()) as { code: string; name: string };
        const copy = buildEvidenceScale({ id: 'copy-1', code: body.code, name: body.name });
        scales = [...scales, copy];
        return HttpResponse.json(copy, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ResponseScalesPage />, { withRouter: false, permissions: editor });

    await user.click(await screen.findByRole('button', { name: 'Duplicar' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Duplicar escala' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Duplicar escala' }));

    expect(await screen.findByText('Escala duplicada como EVIDENCE_4_COPIA.')).toBeInTheDocument();
    const copy = await screen.findByRole('region', {
      name: 'Evidencia en el desempeño (4) (copia)',
    });
    expect(within(copy).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });

  it('reloads the list after a 409 so the card turns into in-use mode (D35)', async () => {
    let inUse = false;
    server.use(
      http.get(BASE, () =>
        HttpResponse.json(buildResponseScalesResponse([buildEvidenceScale({ inUse })])),
      ),
      http.patch(`${BASE}/:id`, () => {
        inUse = true;
        return HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message:
                'La escala está en uso en una encuesta publicada y no se puede modificar. Duplícala para crear una nueva',
            },
          },
          { status: 409 },
        );
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ResponseScalesPage />, { withRouter: false, permissions: editor });

    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    await user.clear(screen.getByLabelText('Nombre'));
    await user.type(screen.getByLabelText('Nombre'), 'Cambio tardío');
    await user.click(screen.getByRole('button', { name: 'Guardar escala' }));

    expect(await screen.findByText('En uso')).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: 'Editar' })).toHaveLength(0);
    expect(screen.getByRole('alert')).toHaveTextContent('Duplícala para crear una nueva');
  });

  it('shows the create button inside the empty state when the user can edit', async () => {
    server.use(http.get(BASE, () => HttpResponse.json({ items: [] })));

    renderWithProviders(<ResponseScalesPage />, { withRouter: false, permissions: editor });

    expect(await screen.findByText(/no hay escalas configuradas/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nueva escala' }).length).toBeGreaterThan(0);
  });
});
