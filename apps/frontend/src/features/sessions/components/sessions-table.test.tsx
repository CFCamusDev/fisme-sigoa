import type { ProcessExecutionStatusValue } from '@sigoa/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { SAMPLE_SESSION_DTO } from '../test/sessions-fixtures';
import { SessionsTable } from './sessions-table';

const PERMISSIONS = [{ code: 'sesion.editar', scope: 'GLOBAL' as const }];

describe('SessionsTable (HU-081, T-081-04)', () => {
  it('disables edit and attendees when all linked executions are closed or voided', () => {
    const executionNamesById = new Map([
      ['exec-1', 'Proceso 2026-I'],
      ['exec-2', 'Proceso 2026-II'],
    ]);
    const executionStatusesById = new Map<string, ProcessExecutionStatusValue>([
      ['exec-1', 'CLOSED'],
      ['exec-2', 'VOIDED'],
    ]);

    renderWithProviders(
      <SessionsTable
        items={[{ ...SAMPLE_SESSION_DTO, executionIds: ['exec-1', 'exec-2'] }]}
        executionNamesById={executionNamesById}
        executionStatusesById={executionStatusesById}
        onEdit={vi.fn()}
        onManageAttendees={vi.fn()}
      />,
      { permissions: PERMISSIONS },
    );

    const attendeesBtn = screen.getByRole('button', { name: 'Asistentes' });
    const editBtn = screen.getByRole('button', { name: 'Editar' });
    const reason = screen.getByText('Sus ejecuciones están Cerradas o Anuladas');

    expect(attendeesBtn).toBeDisabled();
    expect(editBtn).toBeDisabled();
    expect(attendeesBtn).toHaveAttribute('aria-describedby', reason.id);
    expect(editBtn).toHaveAttribute('aria-describedby', reason.id);
  });

  it('keeps edit and attendees enabled when one execution is open', () => {
    const executionNamesById = new Map([
      ['exec-1', 'Proceso 2026-I'],
      ['exec-2', 'Proceso 2026-II'],
    ]);
    const executionStatusesById = new Map<string, ProcessExecutionStatusValue>([
      ['exec-1', 'CLOSED'],
      ['exec-2', 'IN_PROGRESS'],
    ]);

    renderWithProviders(
      <SessionsTable
        items={[{ ...SAMPLE_SESSION_DTO, executionIds: ['exec-1', 'exec-2'] }]}
        executionNamesById={executionNamesById}
        executionStatusesById={executionStatusesById}
        onEdit={vi.fn()}
        onManageAttendees={vi.fn()}
      />,
      { permissions: PERMISSIONS },
    );

    expect(screen.getByRole('button', { name: 'Asistentes' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeEnabled();
    expect(screen.queryByText('Sus ejecuciones están Cerradas o Anuladas')).not.toBeInTheDocument();
  });
});
