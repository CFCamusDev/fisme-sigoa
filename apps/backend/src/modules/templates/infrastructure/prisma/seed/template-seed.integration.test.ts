import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../../test/db/use-test-database.js';
import { OFFICIAL_TEMPLATES } from './template-seed-data.js';
import { seedTemplateDefaults } from './template-seed.js';

describe('seedTemplateDefaults Integration (PostgreSQL real, T-018-12, RF-018, CA1)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  it('seeds every official template as a published version 1', async () => {
    await seedTemplateDefaults(prisma);

    expect(await prisma.template.count()).toBe(20);
    expect(OFFICIAL_TEMPLATES).toHaveLength(20);
    const templates = await prisma.template.findMany({
      include: { versions: true },
      orderBy: { code: 'asc' },
    });
    for (const template of templates) {
      const definition = OFFICIAL_TEMPLATES.find((item) => item.code === template.code);
      expect(definition, template.code).toBeDefined();
      expect(template.name).toBe(definition?.name);
      expect(template.type).toBe(definition?.type);
      expect(template.variables).toEqual(definition?.variables);
      expect(template.createdBy).toBe('SEED');
      expect(template.versions).toHaveLength(1);
      const [version] = template.versions;
      expect(version).toMatchObject({
        number: 1,
        status: 'PUBLISHED',
        content: definition?.content,
        publishedBy: 'SEED',
      });
      expect(version?.publishedAt).not.toBeNull();
    }
    const byType = await prisma.template.groupBy({ by: ['type'], _count: { _all: true } });
    expect(Object.fromEntries(byType.map((row) => [row.type, row._count._all]))).toEqual({
      ANNEX: 11,
      MINUTES: 1,
      SURVEY: 4,
      INSTRUMENT: 4,
    });
  }, 30_000);

  it('is idempotent: a second run changes nothing', async () => {
    await seedTemplateDefaults(prisma);
    const before = await prisma.templateVersion.findMany({ orderBy: { id: 'asc' } });

    await seedTemplateDefaults(prisma);

    expect(await prisma.template.count()).toBe(20);
    expect(await prisma.templateVersion.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
  }, 30_000);

  it('does not overwrite an existing template and creates only the missing ones', async () => {
    const existing = await prisma.template.create({
      data: { code: 'FO-01', name: 'Anexo 1 editado', type: 'ANNEX', variables: [] },
    });
    await prisma.templateVersion.create({
      data: {
        templateId: existing.id,
        number: 2,
        status: 'PUBLISHED',
        content: '<p>versión 2 institucional</p>',
        publishedAt: new Date('2026-11-14T10:00:00.000Z'),
        publishedBy: 'user-1',
      },
    });

    await seedTemplateDefaults(prisma);
    await seedTemplateDefaults(prisma);

    const after = await prisma.template.findUniqueOrThrow({
      where: { id: existing.id },
      include: { versions: { orderBy: { number: 'asc' } } },
    });
    expect(after.name).toBe('Anexo 1 editado');
    expect(after.variables).toEqual([]);
    expect(after.versions.map((version) => [version.number, version.content])).toEqual([
      [2, '<p>versión 2 institucional</p>'],
    ]);
    expect(await prisma.template.count()).toBe(20);
    expect(await prisma.templateVersion.count()).toBe(20);
  }, 30_000);
});
