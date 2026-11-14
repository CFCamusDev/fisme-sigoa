import { StrictMode } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { buildTemplateDetail, buildTemplateVersion } from '@/test/template-fixtures';
import { TemplateEditor } from './template-editor';

const BASE = 'http://localhost:3000/templates/tpl-1';

const administrator = [
  { code: 'plantilla.ver', scope: 'GLOBAL' as const },
  { code: 'plantilla.editar', scope: 'GLOBAL' as const },
  { code: 'plantilla.publicar', scope: 'GLOBAL' as const },
];

function renderEditor() {
  const handlers = {
    onSaved: vi.fn(),
    onPublished: vi.fn(),
    onDirtyChange: vi.fn(),
  };
  renderWithProviders(
    <StrictMode>
      <TemplateEditor detail={buildTemplateDetail({ withDraft: true })} {...handlers} />
    </StrictMode>,
    {
      permissions: administrator,
      queryClient: new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
      }),
      withRouter: false,
    },
  );
  return handlers;
}

describe('TemplateEditor (T-018-29, HU-018)', () => {
  it('ignores a second click on publish while the request is in flight', async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      http.post(`${BASE}/publish`, async () => {
        posts += 1;
        await delay(30);
        return HttpResponse.json(
          buildTemplateVersion({ status: 'PUBLISHED', publishedAt: '2026-11-14T09:00:00.000Z' }),
        );
      }),
    );
    const handlers = renderEditor();
    await user.click(await screen.findByRole('button', { name: 'Publicar versión 2' }));
    const dialog = await screen.findByRole('alertdialog');

    await user.dblClick(within(dialog).getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(handlers.onPublished).toHaveBeenCalledTimes(1));
    expect(posts).toBe(1);
  });

  it('ignores a second click on save while the request is in flight', async () => {
    const user = userEvent.setup();
    let puts = 0;
    server.use(
      http.put(`${BASE}/draft`, async () => {
        puts += 1;
        await delay(30);
        return HttpResponse.json(
          buildTemplateVersion({ content: '<p>{{program.name}} borrador x</p>' }),
        );
      }),
    );
    const handlers = renderEditor();
    await user.type(await screen.findByRole('textbox', { name: 'Contenido HTML' }), ' x');

    await user.dblClick(screen.getByRole('button', { name: 'Guardar borrador' }));

    await waitFor(() => expect(handlers.onSaved).toHaveBeenCalledTimes(1));
    expect(puts).toBe(1);
  });

  it('formats the counter with the Peruvian number format and warns over the limit', async () => {
    const user = userEvent.setup();
    renderEditor();
    const textarea = await screen.findByRole('textbox', { name: 'Contenido HTML' });

    const initial = buildTemplateDetail({ withDraft: true }).draft?.content.length ?? 0;
    const format = new Intl.NumberFormat('es-PE');
    expect(screen.getByText(`${initial} / 40,000 caracteres`)).toBeInTheDocument();

    await user.click(textarea);
    await user.paste('a'.repeat(40_000));

    const counter = await screen.findByText(/\/ 40,000 caracteres/);
    expect(counter.textContent).toBe(`${format.format(initial + 40_000)} / 40,000 caracteres`);
    expect(counter).toHaveClass('text-destructive');
  });

  it('reports the dirty state to the page and clears it on unmount', async () => {
    const user = userEvent.setup();
    const handlers = renderEditor();
    const textarea = await screen.findByRole('textbox', { name: 'Contenido HTML' });

    await user.type(textarea, ' x');

    await waitFor(() => expect(handlers.onDirtyChange).toHaveBeenLastCalledWith(true));
  });

  it('keeps the editor labelled and described for assistive technology', async () => {
    renderEditor();

    const textarea = await screen.findByRole('textbox', { name: 'Contenido HTML' });
    const describedBy = textarea.getAttribute('aria-describedby') ?? '';
    expect(describedBy.split(' ').length).toBeGreaterThanOrEqual(2);
    for (const id of describedBy.split(' ')) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });
});
