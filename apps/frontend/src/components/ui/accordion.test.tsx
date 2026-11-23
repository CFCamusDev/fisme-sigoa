import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion';

describe('Accordion', () => {
  it('accordion single closes the previous item', async () => {
    const user = userEvent.setup();
    render(
      <Accordion type="single" defaultValue="m01">
        <AccordionItem value="m01">
          <AccordionTrigger>M01 Seguridad</AccordionTrigger>
          <AccordionContent>Contenido M01</AccordionContent>
        </AccordionItem>
        <AccordionItem value="m02">
          <AccordionTrigger>M02 Catálogo</AccordionTrigger>
          <AccordionContent>Contenido M02</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    const trigger1 = screen.getByRole('button', { name: 'M01 Seguridad' });
    const trigger2 = screen.getByRole('button', { name: 'M02 Catálogo' });

    expect(trigger1).toHaveAttribute('aria-expanded', 'true');
    expect(trigger2).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger2);

    expect(trigger1).toHaveAttribute('aria-expanded', 'false');
    expect(trigger2).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Contenido M02')).toBeVisible();
  });

  it('accordion multiple keeps several open', async () => {
    const user = userEvent.setup();
    render(
      <Accordion type="multiple" defaultValue={['m01']}>
        <AccordionItem value="m01">
          <AccordionTrigger>M01 Seguridad</AccordionTrigger>
          <AccordionContent>Contenido M01</AccordionContent>
        </AccordionItem>
        <AccordionItem value="m02">
          <AccordionTrigger>M02 Catálogo</AccordionTrigger>
          <AccordionContent>Contenido M02</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    const trigger1 = screen.getByRole('button', { name: 'M01 Seguridad' });
    const trigger2 = screen.getByRole('button', { name: 'M02 Catálogo' });

    await user.click(trigger2);

    expect(trigger1).toHaveAttribute('aria-expanded', 'true');
    expect(trigger2).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Contenido M01')).toBeVisible();
    expect(screen.getByText('Contenido M02')).toBeVisible();
  });
});
