import { afterAll, describe, expect, it } from 'vitest';
import { getTestDatabaseUrl } from '../db/assert-test-database.js';
import { useTestDatabase } from '../db/use-test-database.js';
import { createE2ESeeder, type E2ESeeder } from './e2e-seeder.js';
import { seedE2EUser } from './seed-e2e-user.js';

describe('createE2ESeeder (HU-080, T-080-16)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  let seeder: E2ESeeder | null = null;

  function getSeeder(): E2ESeeder {
    if (!seeder) {
      seeder = createE2ESeeder(getTestDatabaseUrl());
    }
    return seeder;
  }

  afterAll(async () => {
    if (seeder) {
      await seeder.close();
      seeder = null;
    }
  });

  it('seeds the same user rows as seedE2EUser', async () => {
    const cliEmail = `cli-${Date.now()}@example.test`;
    const inProcEmail = `inproc-${Date.now()}@example.test`;

    await seedE2EUser({
      email: cliEmail,
      names: 'Usuario CLI',
      firstSurname: 'Comparacion',
      roles: ['ADMINISTRATOR'],
    });
    await getSeeder().seedUser({
      email: inProcEmail,
      names: 'Usuario Proceso',
      firstSurname: 'Comparacion',
      roles: ['ADMINISTRATOR'],
    });

    const [cliUser, inProcUser] = await Promise.all([
      prisma.user.findUnique({
        where: { email: cliEmail },
        include: { userRoles: { include: { role: true } } },
      }),
      prisma.user.findUnique({
        where: { email: inProcEmail },
        include: { userRoles: { include: { role: true } } },
      }),
    ]);

    expect(cliUser?.status).toBe('ACTIVE');
    expect(inProcUser?.status).toBe(cliUser?.status);
    expect(inProcUser?.userRoles.map((ur) => ur.role.code)).toEqual(
      cliUser?.userRoles.map((ur) => ur.role.code),
    );
  });

  it('resets and seeds the catalog and resolutions', async () => {
    const s = getSeeder();
    await s.seedUser({ email: `cat-${Date.now()}@example.test`, roles: ['ADMINISTRATOR'] });
    await s.resetCatalog();
    expect(await prisma.catalogVersion.count()).toBe(0);

    await s.seedCurrentCatalog();
    expect(await prisma.catalogVersion.count({ where: { status: 'APPROVED' } })).toBe(1);

    await s.seedInValidationCatalogVersion();
    expect(await prisma.catalogVersion.count({ where: { status: 'IN_VALIDATION' } })).toBe(1);

    await s.seedResolution({ number: 'RES-E2E-01', status: 'REGISTERED' });
    expect(await prisma.resolution.count({ where: { number: 'RES-E2E-01' } })).toBe(1);

    await s.resetResolutions();
    expect(await prisma.resolution.count()).toBe(0);

    await s.seedHistoricalCatalog();
    expect(await prisma.catalogVersion.count({ where: { status: 'HISTORICAL' } })).toBe(1);
    expect(await prisma.resolution.count({ where: { status: 'APPROVED' } })).toBe(2);

    await s.resetCatalog();
    expect(await prisma.catalogVersion.count()).toBe(0);
    expect(await prisma.resolution.count()).toBe(0);
  });

  it('seeds and resets templates', async () => {
    const s = getSeeder();
    await s.resetTemplates();
    expect(await prisma.template.count()).toBe(0);

    const id = await s.seedTemplate({ withDraft: true });
    expect(id).toBe('e2e-template-1');
    expect(await prisma.template.count({ where: { id } })).toBe(1);
    expect(await prisma.templateVersion.count({ where: { templateId: id } })).toBe(2);

    await s.resetTemplates();
    expect(await prisma.template.count()).toBe(0);
  });

  it('counts users by surname', async () => {
    const s = getSeeder();
    const surname = `Aislamiento-${Date.now()}`;
    await s.seedUser({ email: `u1-${Date.now()}@example.test`, firstSurname: surname });
    await s.seedUser({ email: `u2-${Date.now()}@example.test`, firstSurname: surname });

    expect(await s.countUsersBySurname(surname)).toBe(2);
    expect(await s.countUsersBySurname(`${surname}-ninguno`)).toBe(0);
  });
});
