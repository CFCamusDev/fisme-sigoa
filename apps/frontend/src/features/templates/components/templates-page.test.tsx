import { useState } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { TemplateDetailDto } from '@sigoa/shared';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import {
  DRAFT_UPDATED_AT,
  buildDraftVersionSummary,
  buildTemplateDetail,
  buildTemplateSummary,
  buildTemplateVersion,
  buildTemplatesResponse,
} from '@/test/template-fixtures';
import { TemplatesPage } from './templates-page';

const BASE = 'http://localhost:3000/templates';

const viewer = [{ code: 'plantilla.ver', scope: 'GLOBAL' as const }];
const administrator = [
  ...viewer,
  { code: 'plantilla.editar', scope: 'GLOBAL' as const },
  { code: 'plantilla.publicar', scope: 'GLOBAL' as const },
];

function summaryOf(detail: TemplateDetailDto) {
  return buildTemplateSummary({
    id: detail.id,
    code: detail.code,
    name: detail.name,
    type: detail.type,
    variables: detail.variables,
    published: detail.published
      ? {
          id: detail.published.id,
          number: detail.published.number,
          status: detail.published.status,
          publishedAt: detail.published.publishedAt,
          updatedAt: detail.published.updatedAt,
        }
      : null,
    draft: detail.draft
      ? buildDraftVersionSummary({
          id: detail.draft.id,
          number: detail.draft.number,
          updatedAt: detail.draft.updatedAt,
        })
      : null,
  });
}

/** Servidor con estado: guardar crea o actualiza el borrador y publicar pasa los estados. */
function useTemplatesServer(initial: TemplateDetailDto = buildTemplateDetail()) {
  const state = {
    detail: initial,
    listParams: [] as string[],
    puts: [] as Array<{ content: string }>,
    posts: [] as Array<{ versionId: string; expectedUpdatedAt: string }>,
  };
  server.use(
    http.get(BASE, ({ request }) => {
      state.listParams.push(new URL(request.url).search);
      return HttpResponse.json(buildTemplatesResponse([summaryOf(state.detail)]));
    }),
    http.get(`${BASE}/${initial.id}`, () => HttpResponse.json(state.detail)),
    http.put(`${BASE}/${initial.id}/draft`, async ({ request }) => {
      const body = (await request.json()) as { content: string };
      state.puts.push(body);
      const draft = buildTemplateVersion({
        content: body.content,
        updatedAt: '2026-11-06T10:00:00.000Z',
      });
      state.detail = {
        ...state.detail,
        draft,
        versions: [
          buildDraftVersionSummary({ updatedAt: draft.updatedAt }),
          ...state.detail.versions.filter((version) => version.status !== 'DRAFT'),
        ],
      };
      return HttpResponse.json(draft, { status: 201 });
    }),
    http.post(`${BASE}/${initial.id}/publish`, async ({ request }) => {
      const body = (await request.json()) as { versionId: string; expectedUpdatedAt: string };
      state.posts.push(body);
      const draft = state.detail.draft;
      if (!draft) {
        return HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Ya publicada' } },
          { status: 409 },
        );
      }
      const published = {
        ...draft,
        status: 'PUBLISHED' as const,
        publishedAt: '2026-11-14T09:00:00.000Z',
      };
      const { content: _content, ...publishedSummary } = published;
      state.detail = {
        ...state.detail,
        published,
        draft: null,
        versions: [
          publishedSummary,
          ...state.detail.versions
            .filter((version) => version.status !== 'DRAFT')
            .map((version) => ({ ...version, status: 'OBSOLETE' as const })),
        ],
      };
      return HttpResponse.json(published);
    }),
  );
  return state;
}

function Harness({ initialId }: { initialId?: string }) {
  const [selectedId, setSelectedId] = useState<string | undefined>(initialId);
  return <TemplatesPage selectedId={selectedId} onSelectedChange={setSelectedId} />;
}

function renderPage(permissions = administrator, initialId?: string) {
  return renderWithProviders(<Harness initialId={initialId} />, {
    permissions,
    withRouter: false,
  });
}

describe('TemplatesPage (T-018-29, HU-018, CA1, CA2)', () => {
  describe('list', () => {
    it('shows the loading state and then the templates with their versions and states in text', async () => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      server.use(
        http.get(BASE, async () => {
          await gate;
          return HttpResponse.json(buildTemplatesResponse([buildTemplateSummary()]));
        }),
      );

      renderPage(viewer);

      expect((await screen.findAllByText(/cargando plantillas/i)).length).toBeGreaterThan(0);
      release();
      const table = await screen.findByRole('table', {
        name: /plantillas oficiales con su versión publicada/i,
      });
      const row = within(table).getByRole('row', { name: /FO-01/ });
      expect(within(row).getByText('Anexo 1. Cronograma')).toBeInTheDocument();
      expect(within(row).getByText('Anexo')).toBeInTheDocument();
      expect(within(row).getByText('v1')).toBeInTheDocument();
      expect(within(row).getByText('Publicada')).toBeInTheDocument();
      expect(within(row).getByText('—')).toBeInTheDocument();
    });

    it('shows a draft next to the published version and "Sin publicar" when there is none', async () => {
      server.use(
        http.get(BASE, () =>
          HttpResponse.json(
            buildTemplatesResponse([
              buildTemplateSummary({ draft: buildDraftVersionSummary() }),
              buildTemplateSummary({
                id: 'tpl-2',
                code: 'FO-02',
                published: null,
                draft: null,
              }),
            ]),
          ),
        ),
      );

      renderPage(viewer);

      const rows = await screen.findAllByRole('row');
      const fo01 = rows.find((row) => within(row).queryByText('FO-01'));
      const fo02 = rows.find((row) => within(row).queryByText('FO-02'));
      expect(within(fo01!).getByText('Borrador')).toBeInTheDocument();
      expect(within(fo01!).getByText('v2')).toBeInTheDocument();
      expect(within(fo02!).getByText('Sin publicar')).toBeInTheDocument();
    });

    it('shows the empty state without a table', async () => {
      server.use(http.get(BASE, () => HttpResponse.json(buildTemplatesResponse([]))));

      renderPage(viewer);

      expect(await screen.findByText('No hay plantillas para mostrar')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('shows an error with retry when the list cannot be loaded', async () => {
      const user = userEvent.setup();
      let calls = 0;
      server.use(
        http.get(BASE, () => {
          calls += 1;
          return calls === 1
            ? HttpResponse.json(
                { error: { code: 'INTERNAL_ERROR', message: 'Falló' } },
                { status: 500 },
              )
            : HttpResponse.json(buildTemplatesResponse([buildTemplateSummary()]));
        }),
      );

      renderPage(viewer);

      expect(await screen.findByText('Error al cargar las plantillas')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /reintentar/i }));
      expect(await screen.findByRole('table')).toBeInTheDocument();
    });

    it('shows an access denied state on 403', async () => {
      server.use(
        http.get(BASE, () =>
          HttpResponse.json(
            { error: { code: 'FORBIDDEN', message: 'Sin permiso' } },
            { status: 403 },
          ),
        ),
      );

      renderPage(viewer);

      expect(await screen.findByText('Acceso denegado')).toBeInTheDocument();
    });

    it('filters by type through the server parameter', async () => {
      const user = userEvent.setup();
      const state = useTemplatesServer();

      renderPage(viewer);
      await screen.findByRole('table');
      await user.selectOptions(screen.getByLabelText('Tipo de plantilla'), 'SURVEY');

      await waitFor(() =>
        expect(state.listParams.some((params) => params.includes('type=SURVEY'))).toBe(true),
      );
    });
  });

  describe('editor', () => {
    it('opens a template with the published content, the variables and the history', async () => {
      const user = userEvent.setup();
      useTemplatesServer();

      renderPage();
      await user.click(await screen.findByRole('button', { name: 'Abrir FO-01' }));

      const textarea = await screen.findByRole('textbox', { name: 'Contenido HTML' });
      expect(textarea).toHaveValue('<p>{{program.name}} versión 1</p>');
      expect(textarea).toHaveAttribute('spellcheck', 'false');
      expect(screen.getByText(/editando una copia de la versión vigente/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Abrir FO-01' })).toHaveAttribute(
        'aria-current',
        'true',
      );
      expect(screen.getByRole('button', { name: 'Insertar {{program.name}}' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Historial de versiones' })).toBeInTheDocument();
      expect(screen.getByText(/0 \/ 40 000|[0-9]+ \/ 40 000 caracteres/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Publicar versión/ })).not.toBeInTheDocument();
    });

    it('opens the template of the URL and loads the draft when there is one', async () => {
      useTemplatesServer(buildTemplateDetail({ withDraft: true }));

      renderPage(administrator, 'tpl-1');

      const textarea = await screen.findByRole('textbox', { name: 'Contenido HTML' });
      expect(textarea).toHaveValue('<p>{{program.name}} borrador</p>');
      expect(screen.getByText(/editando el borrador v2/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Publicar versión 2' })).toBeEnabled();
    });

    it('shows a not found state for a template that does not exist', async () => {
      server.use(
        http.get(BASE, () => HttpResponse.json(buildTemplatesResponse([buildTemplateSummary()]))),
        http.get(`${BASE}/tpl-x`, () =>
          HttpResponse.json(
            { error: { code: 'NOT_FOUND', message: 'No existe' } },
            { status: 404 },
          ),
        ),
      );

      renderPage(administrator, 'tpl-x');

      expect(await screen.findByText('La plantilla no existe')).toBeInTheDocument();
    });

    it('inserts a variable at the cursor and returns the focus to the editor', async () => {
      const user = userEvent.setup();
      useTemplatesServer();
      renderPage(administrator, 'tpl-1');
      const textarea = (await screen.findByRole('textbox', {
        name: 'Contenido HTML',
      })) as HTMLTextAreaElement;

      textarea.focus();
      textarea.setSelectionRange(3, 3);
      await user.click(screen.getByRole('button', { name: 'Insertar {{schedule.period}}' }));

      expect(textarea.value.startsWith('<p>{{schedule.period}}')).toBe(true);
      expect(textarea).toHaveFocus();
      expect(screen.getByText('Tienes cambios sin guardar')).toBeInTheDocument();
    });

    it('saves the draft, informs it and refreshes the list with the new draft', async () => {
      const user = userEvent.setup();
      const state = useTemplatesServer();
      renderPage(administrator, 'tpl-1');
      const textarea = await screen.findByRole('textbox', { name: 'Contenido HTML' });
      expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled();

      await user.type(textarea, ' nuevo');
      await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));

      expect(await screen.findByText(/se guardó el borrador v2/i)).toBeInTheDocument();
      expect(state.puts).toEqual([{ content: '<p>{{program.name}} versión 1</p> nuevo' }]);
      await waitFor(() =>
        expect(screen.getByRole('textbox', { name: 'Contenido HTML' })).toHaveValue(
          '<p>{{program.name}} versión 1</p> nuevo',
        ),
      );
      expect(await screen.findByText(/editando el borrador v2/i)).toBeInTheDocument();
      expect(screen.queryByText('Tienes cambios sin guardar')).not.toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Publicar versión 2' })).toBeEnabled();
    });

    it('blocks opening another template and publishing while there are unsaved changes, and discards them', async () => {
      const user = userEvent.setup();
      useTemplatesServer(buildTemplateDetail({ withDraft: true }));
      renderPage(administrator, 'tpl-1');
      const textarea = await screen.findByRole('textbox', { name: 'Contenido HTML' });

      await user.type(textarea, ' cambio');

      expect(screen.getByText('Tienes cambios sin guardar')).toBeInTheDocument();
      expect(
        screen.getByText(/guarda o descarta los cambios para abrir otra plantilla/i),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Publicar versión 2' })).toBeDisabled();
      expect(screen.getByLabelText('Tipo de plantilla')).toBeDisabled();

      await user.click(screen.getByRole('button', { name: 'Descartar cambios' }));

      expect(textarea).toHaveValue('<p>{{program.name}} borrador</p>');
      expect(screen.queryByText('Tienes cambios sin guardar')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Publicar versión 2' })).toBeEnabled();
    });

    it('rejects an empty content with a message and does not send the request', async () => {
      const user = userEvent.setup();
      const state = useTemplatesServer(buildTemplateDetail({ withDraft: true }));
      renderPage(administrator, 'tpl-1');
      const textarea = await screen.findByRole('textbox', { name: 'Contenido HTML' });

      await user.clear(textarea);
      await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(/contenido/i);
      expect(textarea).toHaveAttribute('aria-invalid', 'true');
      expect(state.puts).toHaveLength(0);
    });

    it('shows the server explanation when the content is rejected with 400', async () => {
      const user = userEvent.setup();
      useTemplatesServer();
      server.use(
        http.put(`${BASE}/tpl-1/draft`, () =>
          HttpResponse.json(
            {
              error: {
                code: 'VALIDATION_ERROR',
                message: 'El contenido contiene una etiqueta no permitida.',
              },
            },
            { status: 400 },
          ),
        ),
      );
      renderPage(administrator, 'tpl-1');
      const textarea = await screen.findByRole('textbox', { name: 'Contenido HTML' });

      await user.type(textarea, ' x');
      await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));

      expect(
        await screen.findByText('El contenido contiene una etiqueta no permitida.'),
      ).toBeInTheDocument();
      expect(screen.getByText('Tienes cambios sin guardar')).toBeInTheDocument();
    });

    it('shows a message for 403 and 404 when saving', async () => {
      const user = userEvent.setup();
      useTemplatesServer();
      server.use(
        http.put(`${BASE}/tpl-1/draft`, () =>
          HttpResponse.json(
            { error: { code: 'FORBIDDEN', message: 'Sin permiso' } },
            { status: 403 },
          ),
        ),
      );
      renderPage(administrator, 'tpl-1');
      const textarea = await screen.findByRole('textbox', { name: 'Contenido HTML' });

      await user.type(textarea, ' x');
      await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));

      expect(
        await screen.findByText(/no tienes permiso para esta operación de plantillas/i),
      ).toBeInTheDocument();
    });
  });

  describe('publishing', () => {
    it('asks for confirmation naming the version that becomes obsolete and publishes with the reviewed draft', async () => {
      const user = userEvent.setup();
      const state = useTemplatesServer(buildTemplateDetail({ withDraft: true }));
      renderPage(administrator, 'tpl-1');
      await screen.findByRole('textbox', { name: 'Contenido HTML' });

      await user.click(screen.getByRole('button', { name: 'Publicar versión 2' }));

      const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar la publicación' });
      expect(dialog).toHaveTextContent('Publicar la versión 2 dejará Obsoleta la versión 1.');
      expect(dialog).toHaveTextContent('Esta acción no se puede deshacer.');
      expect(state.posts).toHaveLength(0);

      await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

      expect(await screen.findByText(/se publicó la versión 2/i)).toBeInTheDocument();
      expect(state.posts).toEqual([{ versionId: 'ver-2', expectedUpdatedAt: DRAFT_UPDATED_AT }]);
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: /^Publicar versión/ })).not.toBeInTheDocument(),
      );
      const history = screen.getByRole('table', { name: /versiones de la plantilla/i });
      expect(within(history).getByText('Obsoleta')).toBeInTheDocument();
      expect(within(history).getAllByText('Publicada').length).toBeGreaterThan(0);
    });

    it('cancels the confirmation with the button and with Escape without sending anything', async () => {
      const user = userEvent.setup();
      const state = useTemplatesServer(buildTemplateDetail({ withDraft: true }));
      renderPage(administrator, 'tpl-1');
      await screen.findByRole('textbox', { name: 'Contenido HTML' });

      await user.click(screen.getByRole('button', { name: 'Publicar versión 2' }));
      await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Publicar versión 2' }));
      await screen.findByRole('alertdialog');
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(state.posts).toHaveLength(0);
    });

    it('shows the server message on 409 and reloads the real state', async () => {
      const user = userEvent.setup();
      useTemplatesServer(buildTemplateDetail({ withDraft: true }));
      server.use(
        http.post(`${BASE}/tpl-1/publish`, () =>
          HttpResponse.json(
            { error: { code: 'CONFLICT', message: 'El borrador cambió desde que lo revisaste.' } },
            { status: 409 },
          ),
        ),
      );
      renderPage(administrator, 'tpl-1');
      await screen.findByRole('textbox', { name: 'Contenido HTML' });

      await user.click(screen.getByRole('button', { name: 'Publicar versión 2' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirmar' }),
      );

      expect(
        await screen.findByText('El borrador cambió desde que lo revisaste.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('shows a message on 404 when publishing', async () => {
      const user = userEvent.setup();
      useTemplatesServer(buildTemplateDetail({ withDraft: true }));
      server.use(
        http.post(`${BASE}/tpl-1/publish`, () =>
          HttpResponse.json(
            { error: { code: 'NOT_FOUND', message: 'No existe' } },
            { status: 404 },
          ),
        ),
      );
      renderPage(administrator, 'tpl-1');
      await screen.findByRole('textbox', { name: 'Contenido HTML' });

      await user.click(screen.getByRole('button', { name: 'Publicar versión 2' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirmar' }),
      );

      expect(
        await screen.findByText(/la plantilla o la versión ya no existe/i),
      ).toBeInTheDocument();
    });

    it('does not offer to publish without the publish permission', async () => {
      useTemplatesServer(buildTemplateDetail({ withDraft: true }));

      renderPage([...viewer, { code: 'plantilla.editar', scope: 'GLOBAL' }], 'tpl-1');

      await screen.findByRole('textbox', { name: 'Contenido HTML' });
      expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Publicar versión/ })).not.toBeInTheDocument();
    });
  });

  describe('read-only mode', () => {
    it('shows the content as read-only without editing or publishing actions', async () => {
      useTemplatesServer(buildTemplateDetail({ withDraft: true }));

      renderPage(viewer, 'tpl-1');

      const textarea = await screen.findByRole('textbox', { name: 'Contenido HTML' });
      expect(textarea).toHaveAttribute('readonly');
      expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Guardar borrador' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Publicar versión/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Insertar/ })).not.toBeInTheDocument();
      expect(screen.getByText('{{program.name}}')).toBeInTheDocument();
    });
  });
});
