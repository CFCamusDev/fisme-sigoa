import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { CatalogSendToValidation } from './catalog-send-to-validation';

describe('CatalogSendToValidation (HU-081, T-081-10)', () => {
  it('shows each precondition state once', () => {
    renderWithProviders(
      <CatalogSendToValidation versionId="v-2" objectiveCount={4} attributeCount={0} />,
      { withRouter: false },
    );

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toBe('Al menos un objetivo educacional (cumplida)');
    expect(items[1]?.textContent).toBe('Al menos un atributo del graduado (pendiente)');
  });
});
