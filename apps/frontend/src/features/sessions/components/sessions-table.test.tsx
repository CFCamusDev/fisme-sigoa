import type { ProcessExecutionStatusValue } from '@sigoa/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { SAMPLE_SESSION_LIST_ITEM } from '../test/sessions-fixtures';
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
        items={[{ ...SAMPLE_SESSION_LIST_ITEM, executionIds: ['exec-1', 'exec-2'] }]}
        executionNamesById={executionNamesById}
        executionStatusesById={executionStatusesById}
        onEdit={vi.fn()}
        onManageAttendees={vi.fn()}
      />,
      { withRouter: false, permissions: PERMISSIONS },
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
        items={[{ ...SAMPLE_SESSION_LIST_ITEM, executionIds: ['exec-1', 'exec-2'] }]}
        executionNamesById={executionNamesById}
        executionStatusesById={executionStatusesById}
        onEdit={vi.fn()}
        onManageAttendees={vi.fn()}
      />,
      { withRouter: false, permissions: PERMISSIONS },
    );

    expect(screen.getByRole('button', { name: 'Asistentes' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeEnabled();
    expect(screen.queryByText('Sus ejecuciones están Cerradas o Anuladas')).not.toBeInTheDocument();
  });

  it('shows the attendee count with es-PE format', () => {
    const executionNamesById = new Map([['exec-1', 'Proceso 2026-I']]);

    renderWithProviders(
      <SessionsTable
        items={[
          {
            ...SAMPLE_SESSION_LIST_ITEM,
            id: 'sess-a',
            executionIds: ['exec-1'],
            attendeeCount: 0,
          },
          {
            ...SAMPLE_SESSION_LIST_ITEM,
            id: 'sess-b',
            executionIds: ['exec-1'],
            attendeeCount: 1234,
          },
        ]}
        executionNamesById={executionNamesById}
        onEdit={vi.fn()}
      />,
      { withRouter: false, permissions: PERMISSIONS },
    );

    expect(screen.getByRole('columnheader', { name: 'Asistentes' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '0' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '1,234' })).toBeInTheDocument();
  });
});
