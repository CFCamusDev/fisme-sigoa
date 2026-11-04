import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { seedAuthorization } from '../../../../test/factories/authorization.js';
import { PrismaUserListReader } from './prisma-user-list-reader.js';

describe('PrismaUserListReader Integration (PostgreSQL real, CA4, RS-020, RNF-030)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const reader = new PrismaUserListReader(uow);

  beforeEach(async () => {
    await seedAuthorization(prisma);
  });

  async function getRoleId(code: string): Promise<string> {
    const role = await prisma.role.findUniqueOrThrow({ where: { code } });
    return role.id;
  }

  let nextDni = 20000000;

  async function createFixtureUser(overrides: {
    names: string;
    firstSurname: string;
    email: string;
    status: 'ACTIVE' | 'INACTIVE' | 'PENDING_ACTIVATION';
    dni?: string | null;
    roleId?: string;
    createdAt?: Date;
  }) {
    const user = await prisma.user.create({
      data: {
        names: overrides.names,
        firstSurname: overrides.firstSurname,
        email: overrides.email,
        dni: overrides.dni === undefined ? String(nextDni++) : overrides.dni,
        status: overrides.status,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash$dummyhash',
        createdAt: overrides.createdAt ?? new Date(),
      },
    });

    if (overrides.roleId) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: overrides.roleId,
          createdBy: 'TEST',
        },
      });
    }

    return user;
  }

  it('filters by status', async () => {
    await createFixtureUser({
      names: 'User 1',
      firstSurname: 'Active',
      email: `active.${Date.now()}@untrm.edu.pe`,
      status: 'ACTIVE',
    });
    await createFixtureUser({
      names: 'User 2',
      firstSurname: 'Inactive',
      email: `inactive.${Date.now()}@untrm.edu.pe`,
      status: 'INACTIVE',
    });

    const activeList = await reader.list({ status: 'ACTIVE', page: 1, pageSize: 10 });
    expect(activeList.total).toBe(1);
    expect(activeList.items[0]?.status).toBe('ACTIVE');

    const inactiveList = await reader.list({ status: 'INACTIVE', page: 1, pageSize: 10 });
    expect(inactiveList.total).toBe(1);
    expect(inactiveList.items[0]?.status).toBe('INACTIVE');
  }, 15_000);

  it('filters by role', async () => {
    const teacherRoleId = await getRoleId('TEACHER');
    const adminRoleId = await getRoleId('ADMINISTRATOR');

    await createFixtureUser({
      names: 'Docente',
      firstSurname: 'Uno',
      email: `docente.${Date.now()}@untrm.edu.pe`,
      status: 'ACTIVE',
      roleId: teacherRoleId,
    });
    await createFixtureUser({
      names: 'Admin',
      firstSurname: 'Uno',
      email: `admin.${Date.now()}@untrm.edu.pe`,
      status: 'ACTIVE',
      roleId: adminRoleId,
    });

    const teacherResult = await reader.list({ roleId: teacherRoleId, page: 1, pageSize: 10 });
    expect(teacherResult.total).toBe(1);
    expect(teacherResult.items[0]?.email).toContain('docente.');

    const adminResult = await reader.list({ roleId: adminRoleId, page: 1, pageSize: 10 });
    expect(adminResult.total).toBe(1);
    expect(adminResult.items[0]?.email).toContain('admin.');
  }, 15_000);

  it('combines status and role', async () => {
    const teacherRoleId = await getRoleId('TEACHER');

    await createFixtureUser({
      names: 'Docente Activo',
      firstSurname: 'Pérez',
      email: `docente.activo.${Date.now()}@untrm.edu.pe`,
      status: 'ACTIVE',
      roleId: teacherRoleId,
    });
    await createFixtureUser({
      names: 'Docente Inactivo',
      firstSurname: 'López',
      email: `docente.inactivo.${Date.now()}@untrm.edu.pe`,
      status: 'INACTIVE',
      roleId: teacherRoleId,
    });

    const result = await reader.list({
      status: 'ACTIVE',
      roleId: teacherRoleId,
      page: 1,
      pageSize: 10,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.names).toBe('Docente Activo');
  }, 15_000);

  it('paginates with a stable order (createdAt desc, id desc) and a correct total', async () => {
    const teacherRoleId = await getRoleId('TEACHER');
    const now = Date.now();

    for (let i = 1; i <= 5; i++) {
      await createFixtureUser({
        names: `User ${i}`,
        firstSurname: `Apellido ${i}`,
        email: `pag_${i}_${now}@untrm.edu.pe`,
        status: 'ACTIVE',
        roleId: teacherRoleId,
        createdAt: new Date(now + i * 1000),
      });
    }

    const page1 = await reader.list({ roleId: teacherRoleId, page: 1, pageSize: 2 });
    expect(page1.total).toBe(5);
    expect(page1.items.length).toBe(2);
    expect(page1.items[0]?.names).toBe('User 5'); // El más reciente primero
    expect(page1.items[1]?.names).toBe('User 4');

    const page2 = await reader.list({ roleId: teacherRoleId, page: 2, pageSize: 2 });
    expect(page2.total).toBe(5);
    expect(page2.items.length).toBe(2);
    expect(page2.items[0]?.names).toBe('User 3');
    expect(page2.items[1]?.names).toBe('User 2');
  }, 15_000);

  it('returns an empty page beyond the last one', async () => {
    await createFixtureUser({
      names: 'User 1',
      firstSurname: 'Single',
      email: `single.${Date.now()}@untrm.edu.pe`,
      status: 'ACTIVE',
    });

    const result = await reader.list({ page: 5, pageSize: 10 });
    expect(result.total).toBe(1);
    expect(result.items).toEqual([]);
  }, 15_000);

  it('returns an empty list for an unknown role', async () => {
    await createFixtureUser({
      names: 'User 1',
      firstSurname: 'Single',
      email: `single.${Date.now()}@untrm.edu.pe`,
      status: 'ACTIVE',
    });

    const result = await reader.list({ roleId: 'role-inexistente-xyz', page: 1, pageSize: 10 });
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  }, 15_000);

  it('includes users without dni', async () => {
    await createFixtureUser({
      names: 'Root',
      firstSurname: 'Admin',
      email: `root.${Date.now()}@untrm.edu.pe`,
      status: 'ACTIVE',
      dni: null,
    });

    const result = await reader.list({ page: 1, pageSize: 10 });
    expect(result.total).toBe(1);
    expect(result.items[0]?.dni).toBeNull();
  }, 15_000);

  it('never exposes credentials in domain entities returned', async () => {
    await createFixtureUser({
      names: 'Secure',
      firstSurname: 'User',
      email: `secure.${Date.now()}@untrm.edu.pe`,
      status: 'ACTIVE',
    });

    const result = await reader.list({ page: 1, pageSize: 10 });
    const user = result.items[0]!;

    expect('passwordHash' in user).toBe(false);
    expect('password' in user).toBe(false);
  }, 15_000);
});
