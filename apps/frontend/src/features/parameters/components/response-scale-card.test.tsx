import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { buildEvidenceScale, buildLikertScale } from '@/test/response-scale-fixtures';
import { ResponseScaleCard } from './response-scale-card';

describe('ResponseScaleCard Component (HU-012, T-012-28, CA1, CA2, CA3)', () => {
  it('renders the name, code, type in Spanish and the level count in a labelled section', () => {
    renderWithProviders(<ResponseScaleCard scale={buildEvidenceScale()} />, { withRouter: false });

    const section = screen.getByRole('region', { name: 'Evidencia en el desempeño (4)' });
    expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Evidencia en el desempeño (4)',
    );
    expect(within(section).getByText(/EVIDENCE_4 · Evidencia · 4 niveles/)).toBeInTheDocument();
  });

  it('collapses levels by default and expands them when requested (CA2, T-082-26)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResponseScaleCard scale={buildEvidenceScale()} />, { withRouter: false });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver niveles' }));

    const rows = within(screen.getByRole('table', { name: /Niveles de/ }))
      .getAllByRole('row')
      .slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      '1Se evidencia totalmente4Cuenta como logro',
      '2Se evidencia mayormente3Cuenta como logro',
      '3Se evidencia parcialmente2No cuenta',
      '4No se evidencia en su desempeño1No cuenta',
    ]);
  });

  it('shows the in-use badge, the note and no Edit button, but keeps Duplicate (CA3)', () => {
    renderWithProviders(
      <ResponseScaleCard
        scale={buildEvidenceScale({ inUse: true })}
        canEdit
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
      />,
      { withRouter: false },
    );

    expect(screen.getByText('En uso')).toBeInTheDocument();
    expect(
      screen.getByText(/no se puede modificar\. Duplícala para crear una nueva/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicar' })).toBeInTheDocument();
  });

  it('offers Edit and Duplicate for a free scale when the user can edit', () => {
    renderWithProviders(
      <ResponseScaleCard
        scale={buildLikertScale()}
        canEdit
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
      />,
      { withRouter: false },
    );

    expect(screen.queryByText('En uso')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicar' })).toBeInTheDocument();
  });

  it('hides every action without the edit permission', () => {
    renderWithProviders(
      <ResponseScaleCard scale={buildLikertScale()} onEdit={vi.fn()} onDuplicate={vi.fn()} />,
      { withRouter: false },
    );

    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duplicar' })).not.toBeInTheDocument();
  });

  it('passes the scale and the clicked button to the handlers', async () => {
    const onEdit = vi.fn();
    const onDuplicate = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ResponseScaleCard
        scale={buildLikertScale()}
        canEdit
        onEdit={onEdit}
        onDuplicate={onDuplicate}
      />,
      { withRouter: false },
    );

    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.click(screen.getByRole('button', { name: 'Duplicar' }));

    expect(onEdit).toHaveBeenCalledWith(
      buildLikertScale(),
      screen.getByRole('button', { name: 'Editar' }),
    );
    expect(onDuplicate).toHaveBeenCalledWith(
      buildLikertScale(),
      screen.getByRole('button', { name: 'Duplicar' }),
    );
  });
});
