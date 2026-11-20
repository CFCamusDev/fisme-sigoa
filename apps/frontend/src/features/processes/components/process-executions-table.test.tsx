import { cleanup, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { SAMPLE_PROCESS_EXECUTION_DTO } from '../test/process-executions-fixtures';
import { ProcessExecutionsTable } from './process-executions-table';

describe('ProcessExecutionsTable (HU-028, T-028-24)', () => {
  it('shows the schedule link only with cronograma.ver', () => {
    renderWithProviders(<ProcessExecutionsTable items={[SAMPLE_PROCESS_EXECUTION_DTO]} />, {
      permissions: [{ code: 'ejecucion.ver', scope: 'GLOBAL' }],
    });

    expect(screen.queryByRole('link', { name: /Cronograma/i })).not.toBeInTheDocument();

    cleanup();
    renderWithProviders(<ProcessExecutionsTable items={[SAMPLE_PROCESS_EXECUTION_DTO]} />, {
      permissions: [
        { code: 'ejecucion.ver', scope: 'GLOBAL' },
        { code: 'cronograma.ver', scope: 'GLOBAL' },
      ],
    });

    const link = screen.getByRole('link', { name: /Cronograma/i });
    expect(link).toHaveAttribute('href', `/cronograma/${SAMPLE_PROCESS_EXECUTION_DTO.id}`);
  });
});
