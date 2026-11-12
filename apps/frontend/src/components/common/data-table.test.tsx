import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { DataTable, type DataTableColumn } from './data-table';

interface SampleItem {
  id: string;
  code: string;
  name: string;
}

const sampleColumns: DataTableColumn<SampleItem>[] = [
  { key: 'code', header: 'Código' },
  { key: 'name', header: 'Nombre del elemento' },
  {
    key: 'actions',
    header: 'Acciones',
    render: (item) => <button type="button">Ver {item.code}</button>,
  },
];

const sampleData: SampleItem[] = [
  { id: '1', code: 'OE01', name: 'Objetivo Educacional 1' },
  { id: '2', code: 'OE02', name: 'Objetivo Educacional 2' },
];

describe('DataTable Component', () => {
  it('renders table headers and rows accurately when data is present', async () => {
    renderWithProviders(
      <DataTable
        columns={sampleColumns}
        data={sampleData}
        keyExtractor={(item) => item.id}
        caption="Lista de objetivos"
      />,
    );

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Código')).toBeInTheDocument();
    expect(screen.getByText('Nombre del elemento')).toBeInTheDocument();
    expect(screen.getByText('Acciones')).toBeInTheDocument();

    expect(screen.getByText('OE01')).toBeInTheDocument();
    expect(screen.getByText('Objetivo Educacional 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver OE01' })).toBeInTheDocument();

    expect(screen.getByText('OE02')).toBeInTheDocument();
    expect(screen.getByText('Objetivo Educacional 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver OE02' })).toBeInTheDocument();

    expect(screen.getByText('Lista de objetivos')).toBeInTheDocument();
  });

  it('renders accessible loading state with role="status"', async () => {
    renderWithProviders(
      <DataTable
        columns={sampleColumns}
        data={[]}
        keyExtractor={(item) => item.id}
        isLoading={true}
      />,
    );

    const status = await screen.findByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent(/Cargando datos de la tabla/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders accessible error state with role="alert" and handles retry', async () => {
    const handleRetry = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <DataTable
        columns={sampleColumns}
        data={[]}
        keyExtractor={(item) => item.id}
        error={new Error('No se pudo conectar al servicio')}
        onRetry={handleRetry}
      />,
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/No se pudo conectar al servicio/i);

    const retryButton = screen.getByRole('button', { name: /Reintentar/i });
    await user.click(retryButton);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when data array is empty and not loading', async () => {
    renderWithProviders(
      <DataTable
        columns={sampleColumns}
        data={[]}
        keyExtractor={(item) => item.id}
        emptyTitle="No hay objetivos registrados"
        emptyDescription="Cree un nuevo objetivo para comenzar."
      />,
    );

    expect(await screen.findByText('No hay objetivos registrados')).toBeInTheDocument();
    expect(screen.getByText('Cree un nuevo objetivo para comenzar.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('allows navigating row actions via Tab and activating with Enter or Space', async () => {
    const user = userEvent.setup();
    const handleAction1 = vi.fn();
    const handleAction2 = vi.fn();

    const interactiveColumns: DataTableColumn<SampleItem>[] = [
      { key: 'code', header: 'Código' },
      {
        key: 'actions',
        header: 'Acciones',
        render: (item) => (
          <button type="button" onClick={item.id === '1' ? handleAction1 : handleAction2}>
            Acción {item.code}
          </button>
        ),
      },
    ];

    renderWithProviders(
      <DataTable columns={interactiveColumns} data={sampleData} keyExtractor={(item) => item.id} />,
    );

    const btn1 = await screen.findByRole('button', { name: 'Acción OE01' });
    const btn2 = screen.getByRole('button', { name: 'Acción OE02' });

    // Navegar con Tab a la primera acción y activar con Enter
    await user.tab();
    expect(btn1).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(handleAction1).toHaveBeenCalledTimes(1);

    // Navegar con Tab a la segunda acción y activar con Espacio
    await user.tab();
    expect(btn2).toHaveFocus();
    await user.keyboard(' ');
    expect(handleAction2).toHaveBeenCalledTimes(1);
  });

  it('allows reaching retry button in error state via keyboard', async () => {
    const user = userEvent.setup();
    const handleRetry = vi.fn();

    renderWithProviders(
      <DataTable
        columns={sampleColumns}
        data={[]}
        keyExtractor={(item) => item.id}
        error="Fallo de red"
        onRetry={handleRetry}
      />,
    );

    const retryBtn = await screen.findByRole('button', { name: /Reintentar/i });
    await user.tab();
    expect(retryBtn).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });
});
