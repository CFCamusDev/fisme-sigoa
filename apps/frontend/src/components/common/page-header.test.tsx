import fs from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './page-header';

describe('PageHeader component', () => {
  it('renders title and description with design token typography', () => {
    render(
      <PageHeader
        title="Gestión de Objetivos"
        description="Configure y supervise los objetivos educacionales vigentes."
      />,
    );

    const heading = screen.getByRole('heading', { level: 1, name: 'Gestión de Objetivos' });
    expect(heading).toBeInTheDocument();
    expect(heading.className).toContain('text-foreground');

    const desc = screen.getByText('Configure y supervise los objetivos educacionales vigentes.');
    expect(desc).toBeInTheDocument();
    expect(desc.className).toContain('text-muted-foreground');
  });

  it('renders action buttons when provided', () => {
    render(
      <PageHeader title="Planes de Estudio" actions={<button type="button">Nuevo plan</button>} />,
    );

    expect(screen.getByRole('button', { name: 'Nuevo plan' })).toBeInTheDocument();
  });

  it('ensures feature pages use PageHeader instead of custom h1 elements', () => {
    const featuresDir = path.resolve(import.meta.dirname, '../../features');
    const pageFiles = fs.globSync('**/components/*-page.tsx', { cwd: featuresDir });
    expect(pageFiles.length).toBeGreaterThan(0);

    const offenders = pageFiles.filter((relPath) => {
      const content = fs.readFileSync(path.join(featuresDir, relPath), 'utf8');
      return /<h1[\s>]/.test(content);
    });

    expect(offenders).toEqual([]);
  });
});
