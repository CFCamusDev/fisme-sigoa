import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { StakeholderImportResult } from './stakeholder-import-result';

describe('StakeholderImportResult (HU-081, T-081-15)', () => {
  it('lists every error of a rejected row as separate list items', () => {
    renderWithProviders(
      <StakeholderImportResult
        result={{
          importId: 'imp-1',
          listId: 'list-1',
          totals: { created: 0, reused: 0, added: 0, alreadyInList: 0, rejected: 1 },
          rejectedRows: [
            {
              rowNumber: 3,
              errors: [
                'El RUC debe tener exactamente 11 dígitos numéricos.',
                'El correo electrónico no tiene un formato válido.',
                'El celular debe tener 9 dígitos e iniciar con 9.',
              ],
            },
          ],
        }}
      />,
      { withRouter: false },
    );

    const rowLabel = screen.getByText(/Fila 3:/i);
    const rowItem = rowLabel.closest('li');
    expect(rowItem).not.toBeNull();
    const errorItems = within(rowItem as HTMLElement).getAllByRole('listitem');
    expect(errorItems.map((item) => item.textContent)).toEqual([
      'El RUC debe tener exactamente 11 dígitos numéricos.',
      'El correo electrónico no tiene un formato válido.',
      'El celular debe tener 9 dígitos e iniciar con 9.',
    ]);
  });
});
