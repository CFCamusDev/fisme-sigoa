import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import {
  buildParametersResponse,
  buildParametersResponseWithNewVersion,
} from '@/test/parameter-fixtures';
import { ParametersForm } from './parameters-form';

const editPermissions = [
  { code: 'parametro.ver', scope: 'GLOBAL' as const },
  { code: 'parametro.editar', scope: 'GLOBAL' as const },
];

const semesters = {
  items: [
    {
      id: 's27a',
      code: '2027-I',
      startDate: '2027-03-01',
      endDate: '2027-07-31',
      updatedAt: '2026-11-09T10:00:00.000Z',
    },
  ],
};

interface PostCapture {
  count: number;
  bodies: unknown[];
}

function useHandlers(options: { postStatus?: number; postDelayMs?: number } = {}): PostCapture {
  const capture: PostCapture = { count: 0, bodies: [] };
  server.use(
    http.get('http://localhost:3000/semesters', () => HttpResponse.json(semesters)),
    http.get('http://localhost:3000/parameters', () =>
      HttpResponse.json(buildParametersResponse('2027-I')),
    ),
    http.post('http://localhost:3000/parameters', async ({ request }) => {
      capture.count += 1;
      capture.bodies.push(await request.json());
      if (options.postDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.postDelayMs));
      }
      const status = options.postStatus ?? 201;
      if (status !== 201) {
        return HttpResponse.json({ error: { code: 'X', message: 'Error' } }, { status });
      }
      return HttpResponse.json(buildParametersResponseWithNewVersion(), { status: 201 });
    }),
  );
  return capture;
}

async function selectSemester(user: ReturnType<typeof userEvent.setup>) {
  const select = await screen.findByLabelText('Vigente desde el semestre');
  await waitFor(() => expect(screen.getByRole('option', { name: '2027-I' })).toBeInTheDocument());
  await user.selectOptions(select, '2027-I');
  await waitFor(() => expect(screen.getByLabelText('Umbral de logrado')).toHaveValue(14));
}

async function setValue(user: ReturnType<typeof userEvent.setup>, label: string, value: string) {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  await user.type(input, value);
}

describe('ParametersForm Component (HU-011, T-011-21)', () => {
  it('preloads the effective values of the chosen semester', async () => {
    useHandlers();
    const user = userEvent.setup();
    renderWithProviders(<ParametersForm />, { withRouter: false, permissions: editPermissions });

    await selectSemester(user);

    expect(screen.getByLabelText('Meta por atributo del graduado')).toHaveValue(70);
    expect(screen.getByLabelText('Peso de la medición directa')).toHaveValue(70);
    expect(screen.getByLabelText('Peso de la medición indirecta')).toHaveValue(30);
    expect(screen.getByLabelText('Participación mínima')).toHaveValue(3);
    expect(screen.getByLabelText('Días de vigencia del token')).toHaveValue(7);
    expect(screen.getByLabelText('Intentos de inicio de sesión')).toHaveValue(5);
    expect(screen.getByText(/suma actual: 100 de 100/i)).toBeInTheDocument();
  });

  it('sends only the changed key and confirms the semester it rules from (CA2)', async () => {
    const capture = useHandlers();
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ParametersForm onSuccess={onSuccess} />, {
      withRouter: false,
      permissions: editPermissions,
    });
    await selectSemester(user);

    await setValue(user, 'Umbral de logrado', '15');
    await user.click(screen.getByRole('button', { name: 'Guardar parámetros' }));

    expect(
      await screen.findByText('Parámetros guardados. Rigen desde el semestre 2027-I.'),
    ).toBeInTheDocument();
    expect(capture.bodies).toEqual([
      { semesterCode: '2027-I', values: [{ key: 'UMBRAL_LOGRADO', value: 15 }] },
    ]);
    expect(onSuccess).toHaveBeenCalledWith('2027-I');
    expect(screen.getByRole('status')).toHaveTextContent('Parámetros guardados');
  });

  it('sends both weights when only one is changed and they add up to 100', async () => {
    const capture = useHandlers();
    const user = userEvent.setup();
    renderWithProviders(<ParametersForm />, { withRouter: false, permissions: editPermissions });
    await selectSemester(user);

    await setValue(user, 'Peso de la medición directa', '60');
    await setValue(user, 'Peso de la medición indirecta', '40');
    await user.click(screen.getByRole('button', { name: 'Guardar parámetros' }));

    await screen.findByText(/parámetros guardados\. rigen desde/i);
    expect(capture.bodies).toEqual([
      {
        semesterCode: '2027-I',
        values: [
          { key: 'PESO_DIRECTA', value: 60 },
          { key: 'PESO_INDIRECTA', value: 40 },
        ],
      },
    ]);
  });

  it('shows the weights error and does not call the API when they do not add up to 100 (CA3)', async () => {
    const capture = useHandlers();
    const user = userEvent.setup();
    renderWithProviders(<ParametersForm />, { withRouter: false, permissions: editPermissions });
    await selectSemester(user);

    await setValue(user, 'Peso de la medición directa', '80');
    expect(screen.getByText(/suma actual: 110 de 100 \(debe ser 100\)/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar parámetros' }));

    expect(await screen.findByText(/deben sumar 100/i)).toBeInTheDocument();
    expect(capture.count).toBe(0);
  });

  it('shows the range error in the field and links it with aria-describedby', async () => {
    const capture = useHandlers();
    const user = userEvent.setup();
    renderWithProviders(<ParametersForm />, { withRouter: false, permissions: editPermissions });
    await selectSemester(user);

    await setValue(user, 'Umbral de logrado', '21');
    await user.click(screen.getByRole('button', { name: 'Guardar parámetros' }));

    const input = screen.getByLabelText('Umbral de logrado');
    expect(
      await screen.findByText(/entre 0 y 20/i, { selector: 'p[role="alert"]' }),
    ).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain('parameter-UMBRAL_LOGRADO-error');
    expect(capture.count).toBe(0);
  });

  it('rejects a decimal value without calling the API', async () => {
    const capture = useHandlers();
    const user = userEvent.setup();
    renderWithProviders(<ParametersForm />, { withRouter: false, permissions: editPermissions });
    await selectSemester(user);

    await setValue(user, 'Umbral de logrado', '13.5');
    await user.click(screen.getByRole('button', { name: 'Guardar parámetros' }));

    expect(
      await screen.findByText(/número entero/i, { selector: 'p[role="alert"]' }),
    ).toBeInTheDocument();
    expect(capture.count).toBe(0);
  });

  it('asks for a semester before saving', async () => {
    const capture = useHandlers();
    const user = userEvent.setup();
    renderWithProviders(<ParametersForm />, { withRouter: false, permissions: editPermissions });

    await user.click(await screen.findByRole('button', { name: 'Guardar parámetros' }));

    expect(await screen.findByText(/elige el semestre/i)).toBeInTheDocument();
    expect(capture.count).toBe(0);
  });

  it('tells the user there is nothing to save and does not call the API', async () => {
    const capture = useHandlers();
    const user = userEvent.setup();
    renderWithProviders(<ParametersForm />, { withRouter: false, permissions: editPermissions });
    await selectSemester(user);

    await user.click(screen.getByRole('button', { name: 'Guardar parámetros' }));

    expect(await screen.findByText('No hay cambios que guardar.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(capture.count).toBe(0);
  });

  it('sends a single request when submitted twice while pending', async () => {
    const capture = useHandlers({ postDelayMs: 50 });
    const user = userEvent.setup();
    renderWithProviders(<ParametersForm />, { withRouter: false, permissions: editPermissions });
    await selectSemester(user);
    await setValue(user, 'Umbral de logrado', '15');

    const button = screen.getByRole('button', { name: 'Guardar parámetros' });
    const form = button.closest('form') as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(await screen.findByText(/parámetros guardados\. rigen desde/i)).toBeInTheDocument();
    expect(capture.count).toBe(1);
  });

  it('disables the button and shows "Guardando…" while the request is in flight', async () => {
    useHandlers({ postDelayMs: 80 });
    const user = userEvent.setup();
    renderWithProviders(<ParametersForm />, { withRouter: false, permissions: editPermissions });
    await selectSemester(user);
    await setValue(user, 'Umbral de logrado', '15');

    await user.click(screen.getByRole('button', { name: 'Guardar parámetros' }));

    const pending = await screen.findByRole('button', { name: 'Guardando…' });
    expect(pending).toBeDisabled();
    await screen.findByText(/parámetros guardados\. rigen desde/i);
  });

  it.each([
    [404, /el semestre elegido ya no existe/i],
    [409, /al mismo tiempo/i],
    [500, /problema del servidor/i],
  ])('shows an actionable alert when the server answers %d', async (status, message) => {
    useHandlers({ postStatus: status });
    const user = userEvent.setup();
    renderWithProviders(<ParametersForm />, { withRouter: false, permissions: editPermissions });
    await selectSemester(user);
    await setValue(user, 'Umbral de logrado', '15');

    await user.click(screen.getByRole('button', { name: 'Guardar parámetros' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
  });

  it('shows a read-only notice and no form without parametro.editar', async () => {
    useHandlers();
    renderWithProviders(<ParametersForm />, {
      withRouter: false,
      permissions: [{ code: 'parametro.ver', scope: 'GLOBAL' as const }],
    });

    expect(
      await screen.findByText(/solo lectura: no tienes permiso para modificar los parámetros/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar parámetros' })).not.toBeInTheDocument();
  });
});
