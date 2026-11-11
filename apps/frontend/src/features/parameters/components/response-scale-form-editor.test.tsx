import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { buildEvidenceScale, buildLikertScale } from '@/test/response-scale-fixtures';
import { ResponseScaleForm } from './response-scale-form';

const BASE = 'http://localhost:3000/response-scales';

function renderCreate(overrides: { onSaved?: () => void; onCancel?: () => void } = {}) {
  return renderWithProviders(
    <ResponseScaleForm
      mode={{ kind: 'create' }}
      onCancel={overrides.onCancel ?? (() => undefined)}
      onSaved={overrides.onSaved ?? (() => undefined)}
    />,
    { withRouter: false },
  );
}

function renderEdit(scale = buildEvidenceScale(), onSaved: () => void = () => undefined) {
  return renderWithProviders(
    <ResponseScaleForm
      mode={{ kind: 'edit', scale }}
      onCancel={() => undefined}
      onSaved={onSaved}
    />,
    { withRouter: false },
  );
}

const labels = () =>
  screen
    .getAllByLabelText(/^Etiqueta del nivel \d+$/)
    .map((input) => (input as HTMLInputElement).value);

describe('ResponseScaleForm level editor (HU-012, T-012-28, CA2, RNF-036)', () => {
  it('starts a new scale with two empty levels', () => {
    renderCreate();

    expect(labels()).toEqual(['', '']);
  });

  it('adds levels up to 10 and then disables the add button with a visible notice', async () => {
    const user = userEvent.setup();
    renderCreate();

    for (let i = 0; i < 8; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Agregar nivel' }));
    }

    expect(labels()).toHaveLength(10);
    expect(screen.getByRole('button', { name: 'Agregar nivel' })).toBeDisabled();
    expect(screen.getByText(/llegaste al máximo de 10 niveles/i)).toBeInTheDocument();
  });

  it('removes levels down to 2 and then disables every remove button', async () => {
    const user = userEvent.setup();
    renderEdit(buildLikertScale());

    expect(labels()).toHaveLength(5);
    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getAllByRole('button', { name: /^Quitar nivel/ })[0]!);
    }

    expect(labels()).toHaveLength(2);
    for (const button of screen.getAllByRole('button', { name: /^Quitar nivel/ })) {
      expect(button).toBeDisabled();
    }
  });

  it('moves a level up and down, and disables the buttons at the ends', async () => {
    const user = userEvent.setup();
    renderEdit(buildEvidenceScale());

    expect(screen.getByRole('button', { name: /^Subir nivel 1:/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Bajar nivel 4:/ })).toBeDisabled();

    await user.click(
      screen.getByRole('button', { name: /^Bajar nivel 1: Se evidencia totalmente/ }),
    );
    expect(labels().slice(0, 2)).toEqual(['Se evidencia mayormente', 'Se evidencia totalmente']);

    await user.click(
      screen.getByRole('button', { name: /^Subir nivel 2: Se evidencia totalmente/ }),
    );
    expect(labels().slice(0, 2)).toEqual(['Se evidencia totalmente', 'Se evidencia mayormente']);
  });

  it('keeps the counts-as-achievement flag with its level when moving it', async () => {
    const user = userEvent.setup();
    renderEdit(buildEvidenceScale());

    await user.click(
      screen.getByRole('button', { name: /^Bajar nivel 2: Se evidencia mayormente/ }),
    );

    expect(labels()[2]).toBe('Se evidencia mayormente');
    expect(screen.getByLabelText('Cuenta como logro del nivel 3')).toBeChecked();
    expect(screen.getByLabelText('Cuenta como logro del nivel 2')).not.toBeChecked();
  });

  it('names every move and remove button with the level and its label', () => {
    renderEdit(buildEvidenceScale());

    expect(
      screen.getByRole('button', { name: 'Subir nivel 2: Se evidencia mayormente' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Quitar nivel 4: No se evidencia en su desempeño' }),
    ).toBeInTheDocument();
  });

  it('shows repeated labels and values as errors on the row, linked with aria-describedby', async () => {
    const user = userEvent.setup();
    renderEdit(buildEvidenceScale());

    await user.clear(screen.getByLabelText('Etiqueta del nivel 2'));
    await user.type(screen.getByLabelText('Etiqueta del nivel 2'), 'se evidencia totalmente');
    await user.clear(screen.getByLabelText('Valor del nivel 3'));
    await user.type(screen.getByLabelText('Valor del nivel 3'), '4');
    await user.click(screen.getByRole('button', { name: 'Guardar escala' }));

    const label = await screen.findByLabelText('Etiqueta del nivel 2');
    expect(label).toHaveAttribute('aria-invalid', 'true');
    expect(label).toHaveAccessibleDescription(/etiquetas de los niveles no se pueden repetir/i);
    const value = screen.getByLabelText('Valor del nivel 3');
    expect(value).toHaveAttribute('aria-invalid', 'true');
    expect(value).toHaveAccessibleDescription(/valores de los niveles no se pueden repetir/i);
  });

  it.each([
    ['below the range', '-1'],
    ['above the range', '101'],
    ['a decimal', '2.5'],
    ['empty', ''],
  ])('rejects a level value that is %s without calling the API', async (_name, text) => {
    let calls = 0;
    server.use(
      http.patch(`${BASE}/:id`, () => {
        calls += 1;
        return HttpResponse.json(buildEvidenceScale());
      }),
    );
    const user = userEvent.setup();
    renderEdit(buildEvidenceScale());

    await user.clear(screen.getByLabelText('Valor del nivel 1'));
    if (text) {
      await user.type(screen.getByLabelText('Valor del nivel 1'), text);
    }
    await user.click(screen.getByRole('button', { name: 'Guardar escala' }));

    expect(await screen.findByLabelText('Valor del nivel 1')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(calls).toBe(0);
  });

  it('sends only the changed name when the levels did not change', async () => {
    let sent: unknown;
    server.use(
      http.patch(`${BASE}/:id`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(buildEvidenceScale({ name: 'Solo el nombre' }));
      }),
    );
    const onSaved = vi.fn();
    const user = userEvent.setup();
    renderEdit(buildEvidenceScale(), onSaved);

    await user.clear(screen.getByLabelText('Nombre'));
    await user.type(screen.getByLabelText('Nombre'), 'Solo el nombre');
    await user.click(screen.getByRole('button', { name: 'Guardar escala' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith('Escala actualizada.'));
    expect(sent).toEqual({ name: 'Solo el nombre' });
  });

  it('sends the new levels with consecutive positions after reordering', async () => {
    let sent: { levels?: { label: string }[] } | undefined;
    server.use(
      http.patch(`${BASE}/:id`, async ({ request }) => {
        sent = (await request.json()) as typeof sent;
        return HttpResponse.json(buildEvidenceScale());
      }),
    );
    const user = userEvent.setup();
    renderEdit(buildEvidenceScale());

    await user.click(screen.getByRole('button', { name: /^Bajar nivel 1:/ }));
    await user.click(screen.getByRole('button', { name: 'Guardar escala' }));

    await vi.waitFor(() => expect(sent).toBeDefined());
    expect(sent?.levels?.map((level) => level.label).slice(0, 2)).toEqual([
      'Se evidencia mayormente',
      'Se evidencia totalmente',
    ]);
  });

  it('disables the save button and shows the saving label while the request is in flight', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.patch(`${BASE}/:id`, async () => {
        await gate;
        return HttpResponse.json(buildEvidenceScale({ name: 'Otro' }));
      }),
    );
    const user = userEvent.setup();
    renderEdit(buildEvidenceScale());

    await user.clear(screen.getByLabelText('Nombre'));
    await user.type(screen.getByLabelText('Nombre'), 'Otro');
    await user.click(screen.getByRole('button', { name: 'Guardar escala' }));

    const saving = await screen.findByRole('button', { name: 'Guardando…' });
    expect(saving).toBeDisabled();
    release();
    expect(await screen.findByRole('button', { name: 'Guardar escala' })).toBeEnabled();
  });

  it('shows a 409 for a repeated code in the code field when creating', async () => {
    server.use(
      http.post(BASE, () =>
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
    renderCreate();

    await user.type(screen.getByLabelText('Código'), 'LIKERT_5');
    await user.type(screen.getByLabelText('Nombre'), 'Otra');
    await user.type(screen.getByLabelText('Etiqueta del nivel 1'), 'Bajo');
    await user.type(screen.getByLabelText('Etiqueta del nivel 2'), 'Alto');
    await user.clear(screen.getByLabelText('Valor del nivel 2'));
    await user.type(screen.getByLabelText('Valor del nivel 2'), '2');
    await user.click(screen.getByRole('button', { name: 'Guardar escala' }));

    expect(
      await screen.findByText(/ya existe una escala de respuesta con el código/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Código')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows the server message in an alert when the scale turned in use while editing (D35)', async () => {
    server.use(
      http.patch(`${BASE}/:id`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message:
                'La escala está en uso en una encuesta publicada y no se puede modificar. Duplícala para crear una nueva',
            },
          },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderEdit(buildEvidenceScale());

    await user.clear(screen.getByLabelText('Nombre'));
    await user.type(screen.getByLabelText('Nombre'), 'Cambio tardío');
    await user.click(screen.getByRole('button', { name: 'Guardar escala' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se pudo guardar la escala');
    expect(alert).toHaveTextContent('Duplícala para crear una nueva');
  });

  it('calls onCancel from the cancel button', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderCreate({ onCancel });

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('moves the focus to the panel heading when it opens', () => {
    renderCreate();

    expect(screen.getByRole('heading', { level: 2, name: 'Nueva escala' })).toHaveFocus();
  });
});
