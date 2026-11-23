import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { SessionAttendeesField } from './session-attendees-field';

describe('SessionAttendeesField (HU-081, T-081-16)', () => {
  it('shows ruc and representative for employer lists and omits a repeated institution', () => {
    renderWithProviders(
      <SessionAttendeesField
        stakeholderType="EMPLOYER"
        items={[
          {
            listMemberId: 'mem-1',
            fullName: 'Tech Amazonas SAC',
            institution: 'Tech Amazonas SAC',
            ruc: '20123456789',
            representative: 'Carlos Mendoza',
            memberPosition: 'Gerente',
            attended: false,
            position: null,
          },
        ]}
        selected={new Map()}
        onToggle={vi.fn()}
        onPositionChange={vi.fn()}
      />,
      { withRouter: false },
    );

    const labelText = screen.getByText('Tech Amazonas SAC').closest('label')?.textContent ?? '';
    expect(labelText).toContain('Tech Amazonas SAC');
    expect(labelText).toContain('RUC 20123456789');
    expect(labelText).toContain('Representante: Carlos Mendoza');
    expect(labelText.match(/Tech Amazonas SAC/g)).toHaveLength(1);
  });
});
