import { describe, expect, it } from 'vitest';
import type { CatalogColumns } from '../../domain/policies/catalog-columns.js';
import { OFFICIAL_TEMPLATES } from '../prisma/seed/template-seed-data.js';
import { catalogColumnKeys, renderTemplateWithCatalogColumns } from './catalog-column-helpers.js';

function getOfficialTemplateContent(code: string): string {
  const template = OFFICIAL_TEMPLATES.find((item) => item.code === code);
  if (!template) {
    throw new Error(`No se encontró la plantilla oficial ${code}`);
  }
  return template.content;
}

function buildFourObjectives(): CatalogColumns['objectives'] {
  return [
    { code: 'OEP1', statement: 'Soluciones tecnológicas innovadoras', order: 1 },
    { code: 'OEP2', statement: 'Gestión de proyectos tecnológicos', order: 2 },
    { code: 'OEP3', statement: 'Administración ética de TIC', order: 3 },
    { code: 'OEP4', statement: 'Investigación científica con innovación', order: 4 },
  ];
}

function buildTwelveAttributes(): CatalogColumns['attributes'] {
  return [
    { code: 'AG-C01', name: 'El Profesional y el Mundo', statement: 'Impacto social', order: 1 },
    { code: 'AG-C02', name: 'Ética', statement: 'Principios éticos', order: 2 },
    {
      code: 'AG-C03',
      name: 'Trabajo Individual y en Equipo',
      statement: 'Equipos diversos',
      order: 3,
    },
    { code: 'AG-C04', name: 'Comunicación', statement: 'Comunicación efectiva', order: 4 },
    { code: 'AG-C05', name: 'Gestión de Proyectos', statement: 'Principios de gestión', order: 5 },
    {
      code: 'AG-C06',
      name: 'Aprendizaje a lo largo de la vida',
      statement: 'Aprendizaje continuo',
      order: 6,
    },
    {
      code: 'AG-C07',
      name: 'Conocimientos de Computación',
      statement: 'Matemáticas y ciencias',
      order: 7,
    },
    {
      code: 'AG-C08',
      name: 'Análisis de Problemas',
      statement: 'Conclusiones fundamentadas',
      order: 8,
    },
    {
      code: 'AG-C09',
      name: 'Diseño y Desarrollo de Soluciones',
      statement: 'Diseño de sistemas',
      order: 9,
    },
    { code: 'AG-C10', name: 'Indagación', statement: 'Investigación previa', order: 10 },
    {
      code: 'AG-C11',
      name: 'Uso de Herramientas',
      statement: 'Técnicas y herramientas',
      order: 11,
    },
    { code: 'AG-C12', name: 'Profesionalismo', statement: 'Práctica profesional', order: 12 },
  ];
}

function buildSampleColumns(overrides: Partial<CatalogColumns> = {}): CatalogColumns {
  return {
    catalogVersionId: 'cv-1',
    catalogVersionNumber: 1,
    objectives: buildFourObjectives(),
    attributes: buildTwelveAttributes(),
    ...overrides,
  };
}

describe('catalog-column-helpers', () => {
  it('exposes the catalog column keys', () => {
    expect(catalogColumnKeys()).toEqual([
      'objectives.code',
      'objectives.statement',
      'attributes.code',
      'attributes.name',
      'attributes.statement',
    ]);
  });

  it('renders exactly the four objective columns of annex 4 from the current catalog', () => {
    const content = getOfficialTemplateContent('FO-04');
    const columns = buildSampleColumns();

    const html = renderTemplateWithCatalogColumns(content, columns, {
      scalars: { 'plan.semester': '2026-I' },
      collections: {},
    });

    for (const objective of columns.objectives) {
      expect(html).toContain(`<th>${objective.code}</th>`);
    }
    const objectiveHeaderMatches = html.match(/<th>OEP\d+<\/th>/g) ?? [];
    expect(objectiveHeaderMatches).toHaveLength(4);
  });

  it.each(['FO-07', 'FO-08', 'FO-09', 'FO-10'])(
    'renders the twelve graduate attributes with code and name in %s',
    (templateCode) => {
      const content = getOfficialTemplateContent(templateCode);
      const columns = buildSampleColumns();

      const html = renderTemplateWithCatalogColumns(content, columns);

      for (const attribute of columns.attributes) {
        expect(html).toContain(attribute.code);
        if (templateCode !== 'FO-08') {
          expect(html).toContain(attribute.name);
        }
      }
      const attributeCodeMatches = html.match(/AG-C\d{2}/g) ?? [];
      expect(new Set(attributeCodeMatches).size).toBe(12);
    },
  );

  it('escapes html in catalog texts', () => {
    const content = getOfficialTemplateContent('FO-07');
    const columns = buildSampleColumns({
      attributes: [
        {
          code: 'AG-C01',
          name: '<script>alert("xss")</script> & Diseño',
          statement: 'Evalúa "sistemas" <críticos> & seguros',
          order: 1,
        },
      ],
    });

    const html = renderTemplateWithCatalogColumns(content, columns);

    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; Diseño');
  });

  it('renders a different number of columns when the catalog changes', () => {
    const content = getOfficialTemplateContent('FO-04');
    const columns = buildSampleColumns({
      objectives: [
        { code: 'OEP1', statement: 'Uno', order: 1 },
        { code: 'OEP2', statement: 'Dos', order: 2 },
        { code: 'OEP3', statement: 'Tres', order: 3 },
        { code: 'OEP4', statement: 'Cuatro', order: 4 },
        { code: 'OEP5', statement: 'Cinco', order: 5 },
      ],
    });

    const html = renderTemplateWithCatalogColumns(content, columns);

    const objectiveHeaderMatches = html.match(/<th>OEP\d+<\/th>/g) ?? [];
    expect(objectiveHeaderMatches).toHaveLength(5);
    expect(html).toContain('<th>OEP5</th>');
  });
});
