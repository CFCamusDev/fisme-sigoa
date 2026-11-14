import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { buildCatalogComparison } from '@/test/catalog-fixtures';
import { CatalogVersionHistoryPanel } from './catalog-version-history-panel';

const comparison = buildCatalogComparison();

describe('CatalogVersionHistoryPanel Component (HU-017, T-017-11, CA2, RN-021)', () => {
  it('shows the resolution and validity dates of a historical version', async () => {
    renderWithProviders(
      <CatalogVersionHistoryPanel history={comparison.base.history} status="HISTORICAL" />,
    );

    const panel = await screen.findByRole('region', { name: 'Resolución y vigencia' });
    expect(within(panel).getByText('Vigente desde').nextElementSibling).toHaveTextContent(
      '01/03/2024',
    );
    expect(within(panel).getByText('Vigente hasta').nextElementSibling).toHaveTextContent(
      '10/05/2026',
    );
    expect(within(panel).getByText('Resolución N.° 128-2024')).toBeInTheDocument();
    expect(within(panel).getByText('Objetivos educacionales')).toBeInTheDocument();
    expect(within(panel).getByText('Emitida el 20/02/2024')).toBeInTheDocument();
    expect(within(panel).getByText('Aprobada')).toBeInTheDocument();
    expect(within(panel).getByText('PDF firmado disponible')).toBeInTheDocument();
  });

  it('says the current version is in force and has no end date', async () => {
    renderWithProviders(
      <CatalogVersionHistoryPanel
        history={{ ...comparison.base.history, validUntil: null }}
        status="APPROVED"
      />,
    );

    expect((await screen.findByText('Vigente hasta')).nextElementSibling).toHaveTextContent(
      'Vigente actualmente',
    );
  });

  it('flags a version without resolution and shows empty dates', async () => {
    renderWithProviders(
      <CatalogVersionHistoryPanel history={comparison.target.history} status="HISTORICAL" />,
    );

    expect(await screen.findByText('Sin resolución registrada')).toBeInTheDocument();
    expect(screen.getByText('Vigente desde').nextElementSibling).toHaveTextContent('—');
    expect(screen.getByText('Vigente hasta').nextElementSibling).toHaveTextContent('—');
    expect(screen.queryByText(/Resolución N\./)).not.toBeInTheDocument();
  });

  it('shows a registered resolution that has no signed PDF yet', async () => {
    renderWithProviders(
      <CatalogVersionHistoryPanel
        status="HISTORICAL"
        history={{
          validFrom: null,
          validUntil: null,
          resolutions: [
            {
              id: 'res-9',
              type: 'GRADUATE_ATTRIBUTE',
              number: '15-2026',
              issuedOn: '2026-01-05',
              status: 'REGISTERED',
              approvedAt: null,
              hasPdf: false,
            },
          ],
        }}
      />,
    );

    expect(await screen.findByText('Registrada')).toBeInTheDocument();
    expect(screen.getByText('Sin PDF firmado')).toBeInTheDocument();
    expect(screen.getByText('Atributos del graduado')).toBeInTheDocument();
    expect(screen.queryByText('Sin resolución registrada')).not.toBeInTheDocument();
  });

  it('links to the resolutions screen', async () => {
    renderWithProviders(
      <CatalogVersionHistoryPanel history={comparison.base.history} status="HISTORICAL" />,
    );

    expect(await screen.findByRole('link', { name: 'Ver las resoluciones' })).toHaveAttribute(
      'href',
      '/resoluciones',
    );
  });
});
