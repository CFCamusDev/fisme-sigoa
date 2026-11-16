import { describe, expect, it } from 'vitest';
import { createCatalogColumnsReader } from './catalog-columns-adapter.js';
import {
  PrismaCatalogProgramReader,
  PrismaCatalogVersionRepository,
  PrismaEducationalObjectiveRepository,
  PrismaGraduateAttributeRepository,
  SEED_ATTRIBUTES,
  SEED_OBJECTIVES,
} from './modules/catalog/index.js';
import { PrismaUnitOfWork } from './shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from './test/db/use-test-database.js';

describe('createCatalogColumnsReader Integration (PostgreSQL real, T-020-02)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const reader = createCatalogColumnsReader({
    programReader: new PrismaCatalogProgramReader(uow),
    versionReader: new PrismaCatalogVersionRepository(uow),
    objectiveReader: new PrismaEducationalObjectiveRepository(uow),
    attributeReader: new PrismaGraduateAttributeRepository(uow),
  });

  async function seedProgramWithVersions() {
    const program = await prisma.program.create({
      data: {
        id: 'prog-epis',
        code: 'EPIS',
        name: 'Ingeniería de Sistemas',
        faculty: 'FISME',
      },
    });

    await prisma.catalogVersion.create({
      data: {
        id: 'cv-hist',
        programId: program.id,
        number: 1,
        status: 'HISTORICAL',
        createdBy: 'seed',
        updatedBy: 'seed',
        objectives: {
          create: {
            code: 'OEP-OLD',
            statement: 'Objetivo histórico',
            order: 1,
            createdBy: 'seed',
            updatedBy: 'seed',
          },
        },
        attributes: {
          create: {
            code: 'AG-OLD',
            name: 'Atributo histórico',
            statement: 'Enunciado histórico',
            order: 1,
            createdBy: 'seed',
            updatedBy: 'seed',
          },
        },
      },
    });

    await prisma.catalogVersion.create({
      data: {
        id: 'cv-curr',
        programId: program.id,
        number: 2,
        status: 'APPROVED',
        createdBy: 'seed',
        updatedBy: 'seed',
        objectives: {
          create: SEED_OBJECTIVES.map((item, index) => ({
            code: item.code,
            statement: item.statement,
            order: index + 1,
            createdBy: 'seed',
            updatedBy: 'seed',
          })),
        },
        attributes: {
          create: SEED_ATTRIBUTES.map((item, index) => ({
            code: item.code,
            name: item.name,
            statement: item.statement,
            order: index + 1,
            createdBy: 'seed',
            updatedBy: 'seed',
          })),
        },
      },
    });

    await prisma.catalogVersion.create({
      data: {
        id: 'cv-draft',
        programId: program.id,
        number: 3,
        status: 'DRAFT',
        createdBy: 'seed',
        updatedBy: 'seed',
        objectives: {
          create: {
            code: 'OEP-DRAFT',
            statement: 'Objetivo en borrador',
            order: 1,
            createdBy: 'seed',
            updatedBy: 'seed',
          },
        },
        attributes: {
          create: {
            code: 'AG-DRAFT',
            name: 'Atributo en borrador',
            statement: 'Enunciado en borrador',
            order: 1,
            createdBy: 'seed',
            updatedBy: 'seed',
          },
        },
      },
    });
  }

  it('reads the objectives of the current catalog version', async () => {
    await seedProgramWithVersions();

    const columns = await reader.readCurrent();

    expect(columns?.catalogVersionId).toBe('cv-curr');
    expect(columns?.catalogVersionNumber).toBe(2);
    expect(columns?.objectives.map((item) => item.code)).toEqual(
      SEED_OBJECTIVES.map((item) => item.code),
    );
  }, 15_000);

  it('reads the graduate attributes of the current catalog version', async () => {
    await seedProgramWithVersions();

    const columns = await reader.readCurrent();

    expect(columns?.attributes).toHaveLength(SEED_ATTRIBUTES.length);
    expect(columns?.attributes.map((item) => ({ code: item.code, name: item.name }))).toEqual(
      SEED_ATTRIBUTES.map((item) => ({ code: item.code, name: item.name })),
    );
  }, 15_000);

  it('ignores draft and historical versions', async () => {
    await seedProgramWithVersions();

    const columns = await reader.readCurrent();

    const objectiveCodes = columns?.objectives.map((item) => item.code) ?? [];
    const attributeCodes = columns?.attributes.map((item) => item.code) ?? [];

    expect(objectiveCodes).not.toContain('OEP-OLD');
    expect(objectiveCodes).not.toContain('OEP-DRAFT');
    expect(attributeCodes).not.toContain('AG-OLD');
    expect(attributeCodes).not.toContain('AG-DRAFT');
  }, 15_000);
});
