import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

describe('Table UI component', () => {
  it('renders complete table structure with institutional design tokens', () => {
    render(
      <Table>
        <TableCaption>Resumen de evaluación</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Atributo</TableHead>
            <TableHead>Nivel</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>AG-C01</TableCell>
            <TableCell>Logrado</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>Total evaluado: 1</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Resumen de evaluación')).toBeInTheDocument();

    const th = screen.getByText('Atributo');
    expect(th.tagName).toBe('TH');
    expect(th.className).toContain('bg-brand-100');
    expect(th.className).toContain('text-brand-700');
    expect(th.className).toContain('text-label');

    const td = screen.getByText('AG-C01');
    expect(td.tagName).toBe('TD');
    expect(td.className).toContain('text-label');

    expect(screen.getByText('Total evaluado: 1')).toBeInTheDocument();
  });
});
