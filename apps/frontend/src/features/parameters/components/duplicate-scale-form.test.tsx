import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { buildEvidenceScale } from '@/test/response-scale-fixtures';
import { DuplicateScaleForm } from './duplicate-scale-form';

const URL_DUPLICATE = 'http://localhost:3000/response-scales/:id/duplicate';

describe('DuplicateScaleForm Component (HU-012, T-012-17, CA3)', () => {
  it('prefills a suggested code and name that can be edited', () => {
    renderWithProviders(
      <DuplicateScaleForm
        scale={buildEvidenceScale()}
        onCancel={() => undefined}
        onDuplicated={vi.fn()}
      />,
      { withRouter: false },
    );

    expect(screen.getByLabelText('Código de la copia')).toHaveValue('EVIDENCE_4_COPIA');
    expect(screen.getByLabelText('Nombre de la copia')).toHaveValue(
      'Evidencia en el desempeño (4) (copia)',
    );
  });

  it('duplicates with the edited code and reports the created scale', async () => {
    let sent: unknown;
    let path = '';
    server.use(
      http.post(URL_DUPLICATE, async ({ request }) => {
        sent = await request.json();
        path = new URL(request.url).pathname;
        return HttpResponse.json(buildEvidenceScale({ id: 'copy-1', code: 'EVIDENCE_4_V2' }), {
          status: 201,
        });
      }),
    );
    const onDuplicated = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <DuplicateScaleForm
        scale={buildEvidenceScale()}
        onCancel={() => undefined}
        onDuplicated={onDuplicated}
      />,
      { withRouter: false },
    );

    await user.clear(screen.getByLabelText('Código de la copia'));
    await user.type(screen.getByLabelText('Código de la copia'), 'EVIDENCE_4_V2');
    await user.click(screen.getByRole('button', { name: 'Duplicar escala' }));

    await vi.waitFor(() => expect(onDuplicated).toHaveBeenCalledTimes(1));
    expect(sent).toMatchObject({ code: 'EVIDENCE_4_V2' });
    expect(path).toBe('/response-scales/scale-evidence/duplicate');
  });

  it('shows a 409 for a repeated code in the code field', async () => {
    server.use(
      http.post(URL_DUPLICATE, () =>
        HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'Ya existe una escala de respuesta con el código especificado.',
            },
          },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <DuplicateScaleForm
        scale={buildEvidenceScale()}
        onCancel={() => undefined}
        onDuplicated={vi.fn()}
      />,
      { withRouter: false },
    );

    await user.click(screen.getByRole('button', { name: 'Duplicar escala' }));

    const code = screen.getByLabelText('Código de la copia');
    expect(
      await screen.findByText(/ya existe una escala de respuesta con el código/i),
    ).toBeInTheDocument();
    expect(code).toHaveAttribute('aria-invalid', 'true');
  });

  it('sends a single request when the duplicate button is clicked twice', async () => {
    let calls = 0;
    server.use(
      http.post(URL_DUPLICATE, async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return HttpResponse.json(buildEvidenceScale({ id: 'copy-1', code: 'EVIDENCE_4_COPIA' }), {
          status: 201,
        });
      }),
    );
    const onDuplicated = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <DuplicateScaleForm
        scale={buildEvidenceScale()}
        onCancel={() => undefined}
        onDuplicated={onDuplicated}
      />,
      { withRouter: false },
    );

    await user.dblClick(screen.getByRole('button', { name: 'Duplicar escala' }));

    await vi.waitFor(() => expect(onDuplicated).toHaveBeenCalledTimes(1));
    expect(calls).toBe(1);
  });

  it.each([
    ['a lowercase code', 'minuscula', 'Copia'],
    ['an empty code', '', 'Copia'],
    ['an empty name', 'COPIA_1', ''],
  ])(
    'rejects %s with an accessible error and without calling the API',
    async (_name, code, name) => {
      let calls = 0;
      server.use(
        http.post(URL_DUPLICATE, () => {
          calls += 1;
          return HttpResponse.json(buildEvidenceScale(), { status: 201 });
        }),
      );
      const user = userEvent.setup();
      renderWithProviders(
        <DuplicateScaleForm
          scale={buildEvidenceScale()}
          onCancel={() => undefined}
          onDuplicated={vi.fn()}
        />,
        { withRouter: false },
      );

      await user.clear(screen.getByLabelText('Código de la copia'));
      if (code) await user.type(screen.getByLabelText('Código de la copia'), code);
      await user.clear(screen.getByLabelText('Nombre de la copia'));
      if (name) await user.type(screen.getByLabelText('Nombre de la copia'), name);
      await user.click(screen.getByRole('button', { name: 'Duplicar escala' }));

      const invalid = await screen.findAllByRole('alert');
      expect(invalid.length).toBeGreaterThan(0);
      expect(calls).toBe(0);
    },
  );

  it('shows a general error for a server failure and moves the focus to the heading on open', async () => {
    server.use(
      http.post(URL_DUPLICATE, () =>
        HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Fallo' } }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <DuplicateScaleForm
        scale={buildEvidenceScale()}
        onCancel={() => undefined}
        onDuplicated={vi.fn()}
      />,
      { withRouter: false },
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Duplicar escala' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Duplicar escala' }));

    expect(await screen.findByText(/problema del servidor/i)).toBeInTheDocument();
  });

  it('calls onCancel from the cancel button', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <DuplicateScaleForm
        scale={buildEvidenceScale()}
        onCancel={onCancel}
        onDuplicated={vi.fn()}
      />,
      { withRouter: false },
    );

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
