import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

describe('Tabs', () => {
  it('moves between tabs with arrow keys and Home/End', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="uno">
        <TabsList aria-label="Secciones">
          <TabsTrigger value="uno">Uno</TabsTrigger>
          <TabsTrigger value="dos">Dos</TabsTrigger>
          <TabsTrigger value="tres">Tres</TabsTrigger>
        </TabsList>
        <TabsContent value="uno">Contenido uno</TabsContent>
        <TabsContent value="dos">Contenido dos</TabsContent>
        <TabsContent value="tres">Contenido tres</TabsContent>
      </Tabs>,
    );

    const tabUno = screen.getByRole('tab', { name: 'Uno' });
    const tabDos = screen.getByRole('tab', { name: 'Dos' });
    const tabTres = screen.getByRole('tab', { name: 'Tres' });

    expect(tabUno).toHaveClass(
      'data-[state=active]:text-brand-700',
      'data-[state=active]:border-brand-700',
    );
    expect(screen.getByText('Contenido uno')).toBeVisible();

    tabUno.focus();
    await user.keyboard('{ArrowRight}');
    expect(tabDos).toHaveFocus();
    expect(screen.getByText('Contenido dos')).toBeVisible();

    await user.keyboard('{End}');
    expect(tabTres).toHaveFocus();
    expect(screen.getByText('Contenido tres')).toBeVisible();

    await user.keyboard('{Home}');
    expect(tabUno).toHaveFocus();
    expect(screen.getByText('Contenido uno')).toBeVisible();
  });
});
