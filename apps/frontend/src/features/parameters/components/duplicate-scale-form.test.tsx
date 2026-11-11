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
});
