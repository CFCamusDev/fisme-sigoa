import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { ParametersResponse } from '@sigoa/shared';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import {
  buildParametersResponse,
  buildParametersResponseWithNewVersion,
} from '@/test/parameter-fixtures';
import { ParametersPage } from './parameters-page';

const semesters = {
  items: [
    {
      id: 's27a',
      code: '2027-I',
      startDate: '2027-03-01',
      endDate: '2027-07-31',
      updatedAt: '2026-11-09T10:00:00.000Z',
    },
    {
      id: 's26b',
      code: '2026-II',
      startDate: '2026-08-01',
      endDate: '2026-12-31',
      updatedAt: '2026-11-09T10:00:00.000Z',
    },
  ],
};

function useHandlers(respond: (semesterCode: string | null) => ParametersResponse | Response) {
  server.use(
    http.get('http://localhost:3000/semesters', () => HttpResponse.json(semesters)),
    http.get('http://localhost:3000/parameters', ({ request }) => {
      const result = respond(new URL(request.url).searchParams.get('semesterCode'));
      return result instanceof Response ? result : HttpResponse.json(result);
    }),
  );
}

describe('ParametersPage Component (HU-011, T-011-21)', () => {
  it('renders the loading state while the parameters are fetching', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('http://localhost:3000/semesters', () => HttpResponse.json(semesters)),
      http.get('http://localhost:3000/parameters', async () => {
        await gate;
        return HttpResponse.json(buildParametersResponse());
      }),
    );

    renderWithProviders(<ParametersPage />, { withRouter: false });

    expect(screen.getAllByText(/cargando parámetros/i).length).toBeGreaterThan(0);
    release();
    expect(await screen.findByRole('table', { name: 'Parámetros vigentes' })).toBeInTheDocument();
  });

  it('renders the access denied state on 403', async () => {
    useHandlers(() =>
      HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'Sin permiso' } }, { status: 403 }),
    );

    renderWithProviders(<ParametersPage />, { withRouter: false });

    expect(
      await screen.findByText(/no tienes permiso para consultar los parámetros/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Parámetros' })).toBeInTheDocument();
  });

  it('renders a generic error on 500 and recovers with the retry button', async () => {
    let calls = 0;
    useHandlers(() => {
      calls += 1;
      if (calls === 1) {
        return HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Fallo' } },
          { status: 500 },
        );
      }
      return buildParametersResponse();
    });
    const user = userEvent.setup();

    renderWithProviders(<ParametersPage />, { withRouter: false });

    expect(await screen.findByText(/error al cargar los parámetros/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(await screen.findByRole('table', { name: 'Parámetros vigentes' })).toBeInTheDocument();
  });

  it('shows the seven defaults (CA1)', async () => {
    useHandlers(() => buildParametersResponse('2027-I'));

    renderWithProviders(<ParametersPage />, { withRouter: false });

    const table = await screen.findByRole('table', { name: 'Parámetros vigentes' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(7);
    const text = rows.map((row) => row.textContent ?? '');
    expect(text[0]).toContain('Umbral de logrado');
    expect(text[0]).toContain('14 / 20');
    expect(text[1]).toContain('70 %');
    expect(text[2]).toContain('70 %');
    expect(text[3]).toContain('30 %');
    expect(text[4]).toContain('3 participantes');
    expect(text[5]).toContain('7 días');
    expect(text[6]).toContain('5 intentos');
    expect(text.every((row) => row.includes('Valor por defecto'))).toBe(true);
    expect(screen.getByText(/rigen en el semestre 2027-I/i)).toBeInTheDocument();
  });

  it('states that defaults apply when there are no started semesters', async () => {
    useHandlers(() => buildParametersResponse(null));

    renderWithProviders(<ParametersPage />, { withRouter: false });

    expect(await screen.findByText(/aún no hay semestres iniciados/i)).toBeInTheDocument();
  });

  it('shows the version history with the new value from its semester (CA2)', async () => {
    useHandlers(() => buildParametersResponseWithNewVersion());
    const user = userEvent.setup();

    renderWithProviders(<ParametersPage />, { withRouter: false });

    const table = await screen.findByRole('table', { name: 'Parámetros vigentes' });
    expect(within(table).getByText('15 / 20')).toBeInTheDocument();

    const history = screen.getByRole('region', { name: 'Historial de vigencias' });
    await user.click(within(history).getByText(/Umbral de logrado/));
    const versions = within(history).getByRole('table', { name: 'Historial de Umbral de logrado' });
    const rows = within(versions).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('14 / 20');
    expect(rows[0]?.textContent).toContain('Valor por defecto');
    expect(rows[0]?.textContent).toContain('2026-II');
    expect(rows[1]?.textContent).toContain('15 / 20');
    expect(rows[1]?.textContent).toContain('Sin fecha de fin');
  });

  it('says that a parameter without changes has a single version', async () => {
    useHandlers(() => buildParametersResponse());

    renderWithProviders(<ParametersPage />, { withRouter: false });

    await screen.findByRole('table', { name: 'Parámetros vigentes' });
    expect(screen.getAllByText('Sin cambios')).toHaveLength(7);
  });

  it('requests the chosen semester when the selector changes', async () => {
    const requested: (string | null)[] = [];
    useHandlers((semesterCode) => {
      requested.push(semesterCode);
      return semesterCode === '2026-II'
        ? buildParametersResponse('2026-II')
        : buildParametersResponse('2027-I');
    });
    const user = userEvent.setup();

    renderWithProviders(<ParametersPage />, { withRouter: false });
    await screen.findByText(/rigen en el semestre 2027-I/i);

    await user.selectOptions(screen.getByLabelText('Ver valores vigentes en'), '2026-II');

    expect(await screen.findByText(/rigen en el semestre 2026-II/i)).toBeInTheDocument();
    expect(requested).toEqual([null, '2026-II']);
  });

  it('offers "Hoy" plus the existing semesters in the selector', async () => {
    useHandlers(() => buildParametersResponse());

    renderWithProviders(<ParametersPage />, { withRouter: false });
    await screen.findByRole('table', { name: 'Parámetros vigentes' });

    const select = screen.getByLabelText('Ver valores vigentes en');
    const options = await within(select).findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Hoy', '2027-I', '2026-II']);
  });
});
