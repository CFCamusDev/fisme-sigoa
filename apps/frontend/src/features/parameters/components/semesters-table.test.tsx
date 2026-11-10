import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SemesterDto } from '@sigoa/shared';
import { SemestersTable } from './semesters-table';

describe('SemestersTable Component (HU-010, T-010-18)', () => {
  it('renders accessible EmptyState when semesters array is empty', () => {
    render(<SemestersTable semesters={[]} />);

    expect(
      screen.getByRole('heading', { level: 3, name: 'Aún no hay semestres registrados' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Los periodos académicos creados aparecerán en esta lista para alimentar los selectores de evaluación.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders table headers and semester rows with formatted dates', () => {
    const semesters: SemesterDto[] = [
      {
        id: 'sem-tab-01',
        code: '2026-I',
        startDate: '2026-03-15',
        endDate: '2026-07-15',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 'sem-tab-02',
        code: '2025-II',
        startDate: '2025-08-18',
        endDate: '2025-12-19',
        createdAt: '2025-08-01T00:00:00.000Z',
        updatedAt: '2025-08-01T00:00:00.000Z',
      },
    ];

    render(<SemestersTable semesters={semesters} />);

    const table = screen.getByRole('table', { name: 'Semestres académicos' });
    expect(table).toBeInTheDocument();

    expect(screen.getByRole('columnheader', { name: 'Código' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Fecha de inicio' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Fecha de fin' })).toBeInTheDocument();

    expect(screen.getByText('2026-I')).toBeInTheDocument();
    expect(screen.getByText('15/03/2026')).toBeInTheDocument();
    expect(screen.getByText('15/07/2026')).toBeInTheDocument();

    expect(screen.getByText('2025-II')).toBeInTheDocument();
    expect(screen.getByText('18/08/2025')).toBeInTheDocument();
    expect(screen.getByText('19/12/2025')).toBeInTheDocument();
  });
});
