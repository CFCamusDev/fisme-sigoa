import { describe, expect, it } from 'vitest';
import { buildTemplateSampleData } from './template-sample-data.js';

describe('buildTemplateSampleData (T-019-02)', () => {
  it('builds three sample items per collection', () => {
    const content = [
      '<p>{{program.name}}</p>',
      '<table><tr data-repeat="objectives"><td>{{objectives.code}}</td><td>{{objectives.title}}</td></tr></table>',
      '<div data-repeat="signers">{{signers.name}}</div>',
    ].join('');

    const data = buildTemplateSampleData(content, [
      { key: 'program.name', label: 'Nombre del programa' },
      { key: 'objectives.code', label: 'Código OE' },
      { key: 'objectives.title', label: 'Título OE' },
      { key: 'signers.name', label: 'Firmante' },
    ]);

    expect(data.scalars['program.name']).toBe('Nombre del programa (ejemplo)');
    expect(data.collections.objectives).toHaveLength(3);
    expect(data.collections.objectives?.[0]).toEqual({
      code: 'Código OE (ejemplo 1)',
      title: 'Título OE (ejemplo 1)',
    });
    expect(data.collections.objectives?.[2]).toEqual({
      code: 'Código OE (ejemplo 3)',
      title: 'Título OE (ejemplo 3)',
    });
    expect(data.collections.signers).toHaveLength(3);
    expect(data.collections.signers?.[1]).toEqual({
      name: 'Firmante (ejemplo 2)',
    });
  });

  it('uses a placeholder image for src variables', () => {
    const content = '<img src="{{logo.url}}" alt="{{logo.alt}}"><p>{{program.name}}</p>';

    const data = buildTemplateSampleData(content, [
      { key: 'logo.url', label: 'Logo del programa' },
      { key: 'logo.alt', label: 'Texto alternativo' },
      { key: 'program.name', label: 'Programa' },
    ]);

    expect(data.scalars['logo.url']).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(data.scalars['logo.alt']).toBe('Texto alternativo (ejemplo)');
    expect(data.scalars['program.name']).toBe('Programa (ejemplo)');
  });
});
