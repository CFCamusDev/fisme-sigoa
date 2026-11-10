import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../../test/db/use-test-database.js';
import { seedProgram } from './program-seed.js';

describe('Program Seed Integration (PostgreSQL real, HU-009, T-009-06, RF-009, D3)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  beforeEach(async () => {
    await prisma.program.deleteMany();
  });

  it('seeds the initial EPIS program when table is empty', async () => {
    await seedProgram(prisma);

    const count = await prisma.program.count();
    expect(count).toBe(1);

    const program = await prisma.program.findFirst();
    expect(program).toMatchObject({
      code: 'EPIS',
      name: 'Escuela Profesional de Ingeniería de Sistemas',
      faculty: 'Facultad de Ingeniería de Sistemas y Mecánica Eléctrica',
      createdBy: 'SEED',
      updatedBy: 'SEED',
    });
    expect(program?.createdAt).toBeDefined();
    expect(program?.updatedAt).toBeDefined();
  }, 15_000);

  it('is idempotent when executed multiple times and does not duplicate', async () => {
    await seedProgram(prisma);
    await seedProgram(prisma);
    await seedProgram(prisma);

    const count = await prisma.program.count();
    expect(count).toBe(1);

    const program = await prisma.program.findFirst();
    expect(program?.code).toBe('EPIS');
  }, 15_000);

  it('respects an already edited program code and does not insert a second row (D3)', async () => {
    await prisma.program.create({
      data: {
        id: 'prog-custom-1',
        code: 'EPIS-CUSTOM',
        name: 'Ingeniería de Sistemas Personalizada',
        faculty: 'Facultad Personalizada',
        createdBy: 'ADMIN',
        updatedBy: 'ADMIN',
      },
    });

    await seedProgram(prisma);

    const count = await prisma.program.count();
    expect(count).toBe(1);

    const program = await prisma.program.findFirst();
    expect(program?.id).toBe('prog-custom-1');
    expect(program?.code).toBe('EPIS-CUSTOM');
    expect(program?.name).toBe('Ingeniería de Sistemas Personalizada');
  }, 15_000);
});
