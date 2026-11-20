import { beforeEach, describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization-fast.js';
import {
  COMMITTEE_PRESIDENT_ROLE_CODE,
  PrismaCommitteePresidentRoleReader,
} from './prisma-committee-president-role-reader.js';

describe('PrismaCommitteePresidentRoleReader Integration (PostgreSQL real, T-025-11)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const reader = new PrismaCommitteePresidentRoleReader(uow);

  beforeEach(async () => {
    await seedAuthorizationFast(prisma);
  });

  it('uses a role code that exists in the authorization seed', async () => {
    const role = await prisma.role.findUnique({
      where: { code: COMMITTEE_PRESIDENT_ROLE_CODE },
    });

    expect(role).not.toBeNull();
    expect(role?.status).toBe('ACTIVE');
  }, 5_000);

  it('lists active holders of the president role without exposing email or dni', async () => {
    const role = await prisma.role.findUniqueOrThrow({
      where: { code: COMMITTEE_PRESIDENT_ROLE_CODE },
    });

    await prisma.user.createMany({
      data: [
        {
          id: 'usr-pres-1',
          names: 'Pedro',
          firstSurname: 'Salas',
          secondSurname: 'Quispe',
          email: 'pedro.salas@example.test',
          status: 'ACTIVE',
        },
        {
          id: 'usr-pres-2',
          names: 'Ana',
          firstSurname: 'Torres',
          secondSurname: null,
          email: 'ana.torres@example.test',
          status: 'ACTIVE',
        },
      ],
    });

    await prisma.userRole.createMany({
      data: [
        { userId: 'usr-pres-1', roleId: role.id },
        { userId: 'usr-pres-2', roleId: role.id },
      ],
    });

    const holders = await reader.listActiveHolders();
    expect(holders).toEqual([
      { userId: 'usr-pres-2', fullName: 'Ana Torres' },
      { userId: 'usr-pres-1', fullName: 'Pedro Salas Quispe' },
    ]);
    for (const holder of holders) {
      expect(Object.keys(holder).sort()).toEqual(['fullName', 'userId']);
    }
  }, 5_000);

  it('ignores inactive users and inactive roles', async () => {
    const role = await prisma.role.findUniqueOrThrow({
      where: { code: COMMITTEE_PRESIDENT_ROLE_CODE },
    });

    await prisma.user.createMany({
      data: [
        {
          id: 'usr-active',
          names: 'Ana',
          firstSurname: 'Torres',
          email: 'ana.active@example.test',
          status: 'ACTIVE',
        },
        {
          id: 'usr-inactive',
          names: 'Rosa',
          firstSurname: 'Vega',
          email: 'rosa.inactive@example.test',
          status: 'INACTIVE',
        },
        {
          id: 'usr-pending',
          names: 'Luis',
          firstSurname: 'Rojas',
          email: 'luis.pending@example.test',
          status: 'PENDING_ACTIVATION',
        },
      ],
    });

    await prisma.userRole.createMany({
      data: [
        { userId: 'usr-active', roleId: role.id },
        { userId: 'usr-inactive', roleId: role.id },
        { userId: 'usr-pending', roleId: role.id },
      ],
    });

    expect(await reader.listActiveHolders()).toEqual([
      { userId: 'usr-active', fullName: 'Ana Torres' },
    ]);

    await prisma.role.update({
      where: { id: role.id },
      data: { status: 'INACTIVE' },
    });

    expect(await reader.listActiveHolders()).toEqual([]);
  }, 5_000);
});
