import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { buildEvidenceScale, buildLikertScale } from '@/test/response-scale-fixtures';
import { ResponseScaleForm } from './response-scale-form';

const BASE = 'http://localhost:3000/response-scales';

async function fillCreateForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Código'), 'MI_ESCALA');
  await user.type(screen.getByLabelText('Nombre'), 'Mi escala');
  await user.type(screen.getByLabelText('Etiqueta del nivel 1'), 'Bajo');
  await user.clear(screen.getByLabelText('Valor del nivel 1'));
  await user.type(screen.getByLabelText('Valor del nivel 1'), '1');
  await user.type(screen.getByLabelText('Etiqueta del nivel 2'), 'Alto');
  await user.clear(screen.getByLabelText('Valor del nivel 2'));
  await user.type(screen.getByLabelText('Valor del nivel 2'), '2');
  await user.click(screen.getByLabelText('Cuenta como logro del nivel 2'));
}

describe('ResponseScaleForm Component (HU-012, T-012-17)', () => {
  it('creates a scale with the levels typed and reports success', async () => {
    let sent: unknown;
    server.use(
      http.post(BASE, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(buildLikertScale({ code: 'MI_ESCALA' }), { status: 201 });
      }),
    );
    const onSaved = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ResponseScaleForm mode={{ kind: 'create' }} onCancel={() => undefined} onSaved={onSaved} />,
      { withRouter: false },
    );

    await fillCreateForm(user);
    await user.click(screen.getByRole('button', { name: 'Guardar escala' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith('Escala creada.'));
    expect(sent).toEqual({
      code: 'MI_ESCALA',
      name: 'Mi escala',
      type: 'LIKERT',
      levels: [
        { label: 'Bajo', value: 1, countsAsAchievement: false },
        { label: 'Alto', value: 2, countsAsAchievement: true },
      ],
    });
  });

  it('shows the validation errors next to the fields and does not call the API', async () => {
    let calls = 0;
    server.use(
      http.post(BASE, () => {
        calls += 1;
        return HttpResponse.json(buildLikertScale(), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <ResponseScaleForm mode={{ kind: 'create' }} onCancel={() => undefined} onSaved={vi.fn()} />,
      { withRouter: false },
    );

    await user.click(screen.getByRole('button', { name: 'Guardar escala' }));

    const code = await screen.findByLabelText('Código');
    expect(code).toHaveAttribute('aria-invalid', 'true');
    expect(code).toHaveAccessibleDescription(/mayúsculas/i);
    expect(screen.getByLabelText('Nombre')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Etiqueta del nivel 1')).toHaveAttribute('aria-invalid', 'true');
    expect(calls).toBe(0);
  });

  it('shows the code and type read-only when editing and prefills the levels', () => {
    renderWithProviders(
      <ResponseScaleForm
        mode={{ kind: 'edit', scale: buildEvidenceScale() }}
        onCancel={() => undefined}
        onSaved={vi.fn()}
      />,
      { withRouter: false },
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Editar escala' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Código')).not.toBeInTheDocument();
    expect(screen.getByText('EVIDENCE_4')).toBeInTheDocument();
    expect(screen.getByLabelText('Etiqueta del nivel 1')).toHaveValue('Se evidencia totalmente');
    expect(screen.getByLabelText('Cuenta como logro del nivel 2')).toBeChecked();
    expect(screen.getByLabelText('Cuenta como logro del nivel 3')).not.toBeChecked();
  });

  it('does not call the API when nothing changed while editing', async () => {
    let calls = 0;
    server.use(
      http.patch(`${BASE}/:id`, () => {
        calls += 1;
        return HttpResponse.json(buildEvidenceScale());
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <ResponseScaleForm
        mode={{ kind: 'edit', scale: buildEvidenceScale() }}
        onCancel={() => undefined}
        onSaved={vi.fn()}
      />,
      { withRouter: false },
    );

    await user.click(screen.getByRole('button', { name: 'Guardar escala' }));

    expect(await screen.findByText('No hay cambios que guardar.')).toBeInTheDocument();
    expect(calls).toBe(0);
  });
});
