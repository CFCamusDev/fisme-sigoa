import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildTemplateSummary } from '@/test/template-fixtures';
import { renderWithProviders } from '@/test/render';
import { TemplatesTable } from './templates-table';

describe('TemplatesTable', () => {
  it('opens a template with a link to its screen', async () => {
    const template = buildTemplateSummary({
      id: 'tpl-fo-01',
      code: 'FO-01',
      name: 'Acta de sesión',
    });

    renderWithProviders(<TemplatesTable templates={[template]} />);

    const link = await screen.findByRole('link', { name: 'Abrir FO-01' });
    expect(link).toHaveAttribute('href', '/plantillas/tpl-fo-01');
    expect(screen.getByText('FO-01')).toBeInTheDocument();
    expect(screen.getByText('Acta de sesión')).toBeInTheDocument();
  });
});
