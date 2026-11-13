import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { describe, expect, it } from 'vitest';
import type { CatalogVersionDetailDto } from '@sigoa/shared';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import {
  buildCatalogAttribute,
  buildCatalogObjective,
  buildCatalogVersion,
  buildCatalogVersionDetail,
} from '@/test/catalog-fixtures';
import { CatalogVersionEditorPage } from './catalog-version-editor-page';

const BASE = 'http://localhost:3000/catalog-versions';
const readOnly = [{ code: 'catalogo.ver', scope: 'GLOBAL' as const }];
const editor = [
  { code: 'catalogo.ver', scope: 'GLOBAL' as const },
  { code: 'catalogo.editar', scope: 'GLOBAL' as const },
];

const currentVersion = buildCatalogVersion({ objectiveCount: 3, attributeCount: 3 });
const currentDetail = buildCatalogVersionDetail({
  version: { id: 'cv-1', number: 1, status: 'APPROVED', basedOnVersionId: null },
});

function mockVersions(detail: CatalogVersionDetailDto = buildCatalogVersionDetail()) {
  server.use(
    http.get(BASE, () => HttpResponse.json({ items: [detail.version, currentVersion] })),
    http.get(`${BASE}/cv-1`, () => HttpResponse.json(currentDetail)),
    http.get(`${BASE}/${detail.version.id}`, () => HttpResponse.json(detail)),
  );
}

function renderEditor(permissions = editor, versionId = 'cv-2') {
  return renderWithProviders(<CatalogVersionEditorPage versionId={versionId} />, { permissions });
}

function dataTransferStub() {
  return { effectAllowed: '', setData: () => undefined };
}

describe('CatalogVersionEditorPage (HU-014, T-014-17, CA1, CA2, CA3)', () => {
  describe('states', () => {
    it('shows the loading state while the version is fetching', async () => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      server.use(
        http.get(`${BASE}/cv-2`, async () => {
          await gate;
          return HttpResponse.json(buildCatalogVersionDetail());
        }),
        http.get(BASE, () => HttpResponse.json({ items: [] })),
      );

      renderEditor();

      expect(
        (await screen.findAllByText(/cargando la versión del catálogo/i)).length,
      ).toBeGreaterThan(0);
      release();
      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('shows a not found message with a way back when the version does not exist', async () => {
      server.use(
        http.get(`${BASE}/cv-9`, () =>
          HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'x' } }, { status: 404 }),
        ),
        http.get(BASE, () => HttpResponse.json({ items: [] })),
      );

      renderEditor(editor, 'cv-9');

      expect(await screen.findByText('Versión no encontrada')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /volver a las versiones/i })).toBeInTheDocument();
    });

    it('shows access denied on 403', async () => {
      server.use(
        http.get(`${BASE}/cv-2`, () =>
          HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'x' } }, { status: 403 }),
        ),
        http.get(BASE, () => HttpResponse.json({ items: [] })),
      );

      renderEditor();

      expect(await screen.findByText('Acceso denegado')).toBeInTheDocument();
    });

    it('shows an error with retry on a server failure', async () => {
      let calls = 0;
      server.use(
        http.get(`${BASE}/cv-2`, () => {
          calls += 1;
          return calls === 1
            ? HttpResponse.json({ error: { code: 'INTERNAL', message: 'x' } }, { status: 500 })
            : HttpResponse.json(buildCatalogVersionDetail());
        }),
        http.get(BASE, () => HttpResponse.json({ items: [] })),
      );
      const user = userEvent.setup();

      renderEditor();
      await screen.findByText('Error al cargar la versión');
      await user.click(screen.getByRole('button', { name: /reintentar/i }));

      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('shows an empty state for a version without objectives or attributes', async () => {
      mockVersions(buildCatalogVersionDetail({ objectiveCount: 0, attributeCount: 0 }));

      renderEditor();

      expect(await screen.findByText(/aún no hay objetivos educacionales/i)).toBeInTheDocument();
      expect(screen.getByText(/aún no hay atributos del graduado/i)).toBeInTheDocument();
    });
  });

  describe('editable draft', () => {
    it('lists both sections with edit and order controls', async () => {
      mockVersions();

      renderEditor();

      expect(
        await screen.findByRole('heading', { level: 1, name: /versión v2 del catálogo/i }),
      ).toBeInTheDocument();
      const objectives = await screen.findByRole('list', { name: 'Objetivos educacionales' });
      expect(within(objectives).getAllByRole('listitem')).toHaveLength(3);
      expect(screen.getByRole('list', { name: 'Atributos del graduado' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Editar OEP2' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Subir OEP2' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Bajar OEP2' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Subir OEP1' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Bajar OEP3' })).toBeDisabled();
      expect(screen.queryByText(/campos están bloqueados/i)).not.toBeInTheDocument();
    });

    it('shows the difference with the current version after saving', async () => {
      mockVersions();
      server.use(
        http.put(`${BASE}/cv-2/attributes`, () =>
          HttpResponse.json({
            items: [
              buildCatalogAttribute(1),
              buildCatalogAttribute(2, { statement: 'Nuevo enunciado oficial.' }),
              buildCatalogAttribute(3),
            ],
          }),
        ),
      );
      const user = userEvent.setup();

      renderEditor();
      const attributes = await screen.findByRole('list', { name: 'Atributos del graduado' });
      expect(within(attributes).queryByText(/modificado/i)).not.toBeInTheDocument();

      await user.click(await screen.findByRole('button', { name: 'Editar AG-C02' }));
      const statement = await screen.findByLabelText('Enunciado');
      await user.clear(statement);
      await user.type(statement, 'Nuevo enunciado oficial.');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(await screen.findByText(/se guardaron los cambios de AG-C02/i)).toBeInTheDocument();
      const updated = screen.getByRole('list', { name: 'Atributos del graduado' });
      const row = within(updated).getByText('AG-C02').closest('li') as HTMLElement;
      expect(within(row).getByText(/modificado/i)).toBeInTheDocument();
      expect(within(row).getByText('Nuevo enunciado oficial.')).toBeInTheDocument();
      expect(within(updated).getAllByText(/modificado/i)).toHaveLength(1);
    });

    it('marks an item that does not exist in the current version as new', async () => {
      mockVersions(
        buildCatalogVersionDetail({
          objectives: [buildCatalogObjective(1), buildCatalogObjective(9)],
        }),
      );

      renderEditor();

      const objectives = await screen.findByRole('list', { name: 'Objetivos educacionales' });
      const row = within(objectives).getByText('OEP9').closest('li') as HTMLElement;
      expect(await within(row).findByText(/nuevo/i)).toBeInTheDocument();
      expect(within(objectives).getAllByText(/nuevo/i)).toHaveLength(1);
      expect(
        await screen.findByText(/ya no están en esta versión: OEP2, OEP3/i),
      ).toBeInTheDocument();
    });

    it('adds an objective and confirms it', async () => {
      mockVersions();
      let body: unknown;
      server.use(
        http.put(`${BASE}/cv-2/objectives`, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({
            items: [
              buildCatalogObjective(1),
              buildCatalogObjective(2),
              buildCatalogObjective(3),
              buildCatalogObjective(4, { statement: 'Nuevo objetivo.' }),
            ],
          });
        }),
      );
      const user = userEvent.setup();

      renderEditor();
      await user.click(await screen.findByRole('button', { name: 'Agregar objetivo' }));
      await user.type(await screen.findByLabelText('Código'), 'OEP4');
      await user.type(screen.getByLabelText('Enunciado'), 'Nuevo objetivo.');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(await screen.findByText(/se agregó OEP4 al final de la lista/i)).toBeInTheDocument();
      expect(body).toEqual({ operation: 'SAVE', code: 'OEP4', statement: 'Nuevo objetivo.' });
      expect(screen.queryByRole('form', { name: /agregar elemento/i })).not.toBeInTheDocument();
    });

    it('shows the duplicated code error next to the code field', async () => {
      mockVersions();
      server.use(
        http.put(`${BASE}/cv-2/objectives`, () =>
          HttpResponse.json(
            {
              error: {
                code: 'CONFLICT',
                message: 'Ya existe un elemento con ese código en la versión del catálogo.',
              },
            },
            { status: 409 },
          ),
        ),
      );
      const user = userEvent.setup();

      renderEditor();
      await user.click(await screen.findByRole('button', { name: 'Agregar objetivo' }));
      await user.type(await screen.findByLabelText('Código'), 'OEP2');
      await user.type(screen.getByLabelText('Enunciado'), 'Repetido.');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      const error = await screen.findByText(/ya existe un elemento con ese código/i);
      expect(screen.getByLabelText('Código')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText('Código')).toHaveAccessibleDescription(error.textContent ?? '');
    });

    it('validates the form before sending anything', async () => {
      mockVersions();
      let puts = 0;
      server.use(
        http.put(`${BASE}/cv-2/attributes`, () => {
          puts += 1;
          return HttpResponse.json({ items: [] });
        }),
      );
      const user = userEvent.setup();

      renderEditor();
      await user.click(await screen.findByRole('button', { name: 'Agregar atributo' }));
      await user.type(await screen.findByLabelText('Código'), 'ag 13');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(
        await screen.findByText(/el código debe tener de 2 a 20 caracteres/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/el nombre es obligatorio/i)).toBeInTheDocument();
      expect(screen.getByText(/el enunciado es obligatorio/i)).toBeInTheDocument();
      expect(puts).toBe(0);
    });

    it('sends one request when Save is double clicked', async () => {
      mockVersions();
      let puts = 0;
      server.use(
        http.put(`${BASE}/cv-2/objectives`, async () => {
          puts += 1;
          await delay(40);
          return HttpResponse.json({ items: [buildCatalogObjective(1)] });
        }),
      );
      const user = userEvent.setup();

      renderEditor();
      await user.click(await screen.findByRole('button', { name: 'Agregar objetivo' }));
      await user.type(await screen.findByLabelText('Código'), 'OEP4');
      await user.type(screen.getByLabelText('Enunciado'), 'Texto.');
      await user.dblClick(screen.getByRole('button', { name: 'Guardar' }));

      await screen.findByText(/se agregó OEP4/i);
      expect(puts).toBe(1);
    });

    it('disables the controls while a request is in flight', async () => {
      mockVersions();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      server.use(
        http.put(`${BASE}/cv-2/objectives`, async () => {
          await gate;
          return HttpResponse.json({
            items: [buildCatalogObjective(2), buildCatalogObjective(1), buildCatalogObjective(3)],
          });
        }),
      );
      const user = userEvent.setup();

      renderEditor();
      await user.click(await screen.findByRole('button', { name: 'Bajar OEP1' }));

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Editar OEP2' })).toBeDisabled(),
      );
      expect(screen.getByRole('button', { name: 'Agregar objetivo' })).toBeDisabled();
      release();
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Editar OEP2' })).toBeEnabled(),
      );
    });
  });

  describe('ordering', () => {
    it('reorders with the buttons and announces the new order', async () => {
      mockVersions();
      let body: unknown;
      server.use(
        http.put(`${BASE}/cv-2/objectives`, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({
            items: [
              buildCatalogObjective(2, { order: 1 }),
              buildCatalogObjective(1, { order: 2 }),
              buildCatalogObjective(3),
            ],
          });
        }),
      );
      const user = userEvent.setup();

      renderEditor();
      await user.click(await screen.findByRole('button', { name: 'Bajar OEP1' }));

      expect(body).toEqual({ operation: 'REORDER', orderedIds: ['oe-2', 'oe-1', 'oe-3'] });
      const announcement = await screen.findByText('Orden actualizado: OEP2, OEP1, OEP3.');
      expect(announcement.closest('[aria-live="polite"]')).not.toBeNull();
      const objectives = screen.getByRole('list', { name: 'Objetivos educacionales' });
      const codes = within(objectives)
        .getAllByRole('listitem')
        .map((item) => within(item).getAllByText(/^OEP\d$/)[0]?.textContent);
      expect(codes).toEqual(['OEP2', 'OEP1', 'OEP3']);
    });

    it('reorders with drag and drop events', async () => {
      mockVersions();
      let body: unknown;
      server.use(
        http.put(`${BASE}/cv-2/objectives`, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({
            items: [
              buildCatalogObjective(2, { order: 1 }),
              buildCatalogObjective(3, { order: 2 }),
              buildCatalogObjective(1, { order: 3 }),
            ],
          });
        }),
      );

      renderEditor();
      const objectives = await screen.findByRole('list', { name: 'Objetivos educacionales' });
      const [first, , third] = within(objectives).getAllByRole('listitem');

      fireEvent.dragStart(first as HTMLElement, { dataTransfer: dataTransferStub() });
      fireEvent.dragOver(third as HTMLElement, { dataTransfer: dataTransferStub() });
      fireEvent.drop(third as HTMLElement, { dataTransfer: dataTransferStub() });

      await screen.findByText('Orden actualizado: OEP2, OEP3, OEP1.');
      expect(body).toEqual({ operation: 'REORDER', orderedIds: ['oe-2', 'oe-3', 'oe-1'] });
    });

    it('does not send anything when an item is dropped on itself', async () => {
      mockVersions();
      let puts = 0;
      server.use(
        http.put(`${BASE}/cv-2/objectives`, () => {
          puts += 1;
          return HttpResponse.json({ items: [] });
        }),
      );

      renderEditor();
      const objectives = await screen.findByRole('list', { name: 'Objetivos educacionales' });
      const [first] = within(objectives).getAllByRole('listitem');

      fireEvent.dragStart(first as HTMLElement, { dataTransfer: dataTransferStub() });
      fireEvent.drop(first as HTMLElement, { dataTransfer: dataTransferStub() });

      expect(puts).toBe(0);
    });

    it('shows the server message and reloads the list when the order is outdated', async () => {
      let details = 0;
      server.use(
        http.get(BASE, () =>
          HttpResponse.json({ items: [buildCatalogVersionDetail().version, currentVersion] }),
        ),
        http.get(`${BASE}/cv-1`, () => HttpResponse.json(currentDetail)),
        http.get(`${BASE}/cv-2`, () => {
          details += 1;
          return HttpResponse.json(buildCatalogVersionDetail());
        }),
        http.put(`${BASE}/cv-2/objectives`, () =>
          HttpResponse.json(
            { error: { code: 'CONFLICT', message: 'La lista cambió mientras la ordenabas.' } },
            { status: 409 },
          ),
        ),
      );
      const user = userEvent.setup();

      renderEditor();
      await user.click(await screen.findByRole('button', { name: 'Bajar OEP1' }));

      expect(await screen.findByText('La lista cambió mientras la ordenabas.')).toBeInTheDocument();
      await waitFor(() => expect(details).toBe(2));
    });
  });

  describe('locked', () => {
    it('locks every field when the version is not a draft', async () => {
      mockVersions(
        buildCatalogVersionDetail({
          version: { status: 'IN_VALIDATION' },
          objectiveCount: 2,
          attributeCount: 2,
        }),
      );

      renderEditor();

      expect(await screen.findByText(/sus campos están bloqueados/i)).toBeInTheDocument();
      const codeFields = await screen.findAllByLabelText('Código');
      const statements = screen.getAllByLabelText('Enunciado');
      expect(codeFields).toHaveLength(4);
      expect(statements).toHaveLength(4);
      for (const field of [...codeFields, ...statements, ...screen.getAllByLabelText('Nombre')]) {
        expect(field).toBeDisabled();
      }
      expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /subir|bajar/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /agregar/i })).not.toBeInTheDocument();
    });

    it('shows the current approved version read only', async () => {
      server.use(
        http.get(BASE, () => HttpResponse.json({ items: [currentVersion] })),
        http.get(`${BASE}/cv-1`, () => HttpResponse.json(currentDetail)),
      );

      renderEditor(editor, 'cv-1');

      expect((await screen.findAllByText(/aprobada \(vigente\)/i)).length).toBeGreaterThan(0);
      expect(await screen.findByText(/sus campos están bloqueados/i)).toBeInTheDocument();
      expect(screen.queryByText(/modificado/i)).not.toBeInTheDocument();
    });

    it('shows a draft read only when the user lacks catalogo.editar', async () => {
      mockVersions();

      renderEditor(readOnly);

      expect(await screen.findByText(/solo lectura: no tienes permiso/i)).toBeInTheDocument();
      for (const field of await screen.findAllByLabelText('Enunciado')) {
        expect(field).toBeDisabled();
      }
      expect(
        screen.queryByRole('button', { name: /agregar|editar|subir|bajar/i }),
      ).not.toBeInTheDocument();
    });
  });
});

describe('CatalogVersionEditorPage send to validation (HU-015, T-015-09, CA1, CA2)', () => {
  const sendButton = () => screen.getByRole('button', { name: 'Enviar a validación' });

  it('lists the unmet precondition and disables the send button', async () => {
    mockVersions(buildCatalogVersionDetail({ attributeCount: 0 }));

    renderEditor();

    const list = await screen.findByRole('list', { name: 'Precondiciones para el envío' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Al menos un objetivo educacional: cumplida');
    expect(items[1]).toHaveTextContent('Al menos un atributo del graduado: pendiente');
    expect(sendButton()).toBeDisabled();
  });

  it('lists the unmet objectives precondition too', async () => {
    mockVersions(buildCatalogVersionDetail({ objectiveCount: 0 }));

    renderEditor();

    const list = await screen.findByRole('list', { name: 'Precondiciones para el envío' });
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent(
      'Al menos un objetivo educacional: pendiente',
    );
    expect(sendButton()).toBeDisabled();
  });

  it('sends the version to validation after confirming', async () => {
    const user = userEvent.setup();
    const detail = buildCatalogVersionDetail();
    let posts = 0;
    mockVersions(detail);
    server.use(
      http.post(`${BASE}/cv-2/validation`, async () => {
        posts += 1;
        await delay(30);
        return HttpResponse.json({ ...detail.version, status: 'IN_VALIDATION' });
      }),
    );

    renderEditor();
    await screen.findByRole('list', { name: 'Precondiciones para el envío' });
    expect(sendButton()).toBeEnabled();
    await user.click(sendButton());

    expect(posts).toBe(0);
    expect(screen.getByText(/los textos quedarán bloqueados/i)).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Confirmar envío' });
    await waitFor(() => expect(confirm).toHaveFocus());
    await user.click(confirm);

    expect(await screen.findByText(/sus campos están bloqueados/i)).toBeInTheDocument();
    expect(posts).toBe(1);
    expect(screen.queryByRole('button', { name: 'Enviar a validación' })).not.toBeInTheDocument();
  });

  it('cancels the confirmation with the button and with Escape without sending', async () => {
    const user = userEvent.setup();
    let posts = 0;
    mockVersions();
    server.use(
      http.post(`${BASE}/cv-2/validation`, () => {
        posts += 1;
        return HttpResponse.json(buildCatalogVersion({ id: 'cv-2', status: 'IN_VALIDATION' }));
      }),
    );

    renderEditor();
    await screen.findByRole('list', { name: 'Precondiciones para el envío' });
    await user.click(sendButton());
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(sendButton()).toBeEnabled();

    await user.click(sendButton());
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('button', { name: 'Confirmar envío' })).not.toBeInTheDocument();
    expect(sendButton()).toBeEnabled();
    expect(posts).toBe(0);
  });

  it('shows the server message when the version was already sent (409)', async () => {
    const user = userEvent.setup();
    mockVersions();
    server.use(
      http.post(`${BASE}/cv-2/validation`, () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'La transición de estado no está permitida.' } },
          { status: 409 },
        ),
      ),
    );

    renderEditor();
    await screen.findByRole('list', { name: 'Precondiciones para el envío' });
    await user.click(sendButton());
    await user.click(screen.getByRole('button', { name: 'Confirmar envío' }));

    expect(
      await screen.findByText('La transición de estado no está permitida.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar envío' })).not.toBeInTheDocument();
  });

  it('hides the action without catalogo.editar', async () => {
    mockVersions();

    renderEditor(readOnly);

    expect(await screen.findByText(/solo lectura: no tienes permiso/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar a validación' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Precondiciones para el envío' })).toBeNull();
  });

  it.each(['IN_VALIDATION', 'APPROVED'] as const)(
    'hides the action when the version is %s',
    async (status) => {
      mockVersions(buildCatalogVersionDetail({ version: { status } }));

      renderEditor();

      expect(await screen.findByText(/sus campos están bloqueados/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Enviar a validación' })).not.toBeInTheDocument();
    },
  );
});
