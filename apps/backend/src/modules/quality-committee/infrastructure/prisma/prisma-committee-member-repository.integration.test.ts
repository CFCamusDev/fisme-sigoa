import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { InvalidQualityCommitteeDataError } from '../../domain/errors/invalid-quality-committee-data-error.js';
import { PrismaCommitteeMemberRepository } from './prisma-committee-member-repository.js';
import { PrismaCommitteeUserReader } from './prisma-committee-user-reader.js';
import { PrismaQualityCommitteeRepository } from './prisma-quality-committee-repository.js';

describe('PrismaCommitteeMemberRepository Integration (PostgreSQL real, T-025-24)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const committeeRepository = new PrismaQualityCommitteeRepository(uow);
  const memberRepository = new PrismaCommitteeMemberRepository(uow);
  const userReader = new PrismaCommitteeUserReader(uow);

  const NOW = new Date('2026-11-19T15:00:00.000Z');

  async function seedCommitteeAndUsers() {
    await prisma.program.upsert({
      where: { id: 'prog-1' },
      update: {},
      create: {
        id: 'prog-1',
        code: 'EPIS',
        name: 'Ingeniería de Sistemas',
        faculty: 'FISME',
      },
    });

    await prisma.user.createMany({
      data: [
        {
          id: 'usr-1',
          names: 'Ana',
          firstSurname: 'Torres',
          secondSurname: 'Quispe',
          email: 'ana.torres@example.test',
          status: 'ACTIVE',
        },
        {
          id: 'usr-2',
          names: 'Luis',
          firstSurname: 'Rojas',
          secondSurname: null,
          email: 'luis.rojas@example.test',
          status: 'ACTIVE',
        },
        {
          id: 'usr-3',
          names: 'Rosa',
          firstSurname: 'Vega',
          secondSurname: 'Díaz',
          email: 'rosa.vega@example.test',
          status: 'INACTIVE',
        },
      ],
    });

    await committeeRepository.create({
      id: 'com-2027',
      programId: 'prog-1',
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      actorId: 'usr-1',
      now: NOW,
    });
  }

  it('persists members with degree, position and user link and reads users without email or dni', async () => {
    await seedCommitteeAndUsers();

    const saved = await uow.run(() =>
      memberRepository.createMany({
        committeeId: 'com-2027',
        entries: [
          { fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT', userId: 'usr-1' },
          { fullName: 'Carlos Méndez', degree: 'Mg.', position: 'MEMBER', userId: null },
          { fullName: 'Elena Paredes', degree: 'Ing.', position: 'MEMBER', userId: null },
        ],
        actorId: 'usr-1',
        now: NOW,
      }),
    );

    expect(saved).toHaveLength(3);
    expect(
      saved.map((member) => ({
        fullName: member.fullName,
        degree: member.degree,
        position: member.position,
        userId: member.userId,
      })),
    ).toEqual([
      { fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT', userId: 'usr-1' },
      { fullName: 'Carlos Méndez', degree: 'Mg.', position: 'MEMBER', userId: null },
      { fullName: 'Elena Paredes', degree: 'Ing.', position: 'MEMBER', userId: null },
    ]);

    const byCommittees = await memberRepository.listByCommittees(['com-2027']);
    expect(byCommittees).toHaveLength(3);

    const byIds = await userReader.findByIds(['usr-1', 'usr-2']);
    expect(byIds).toHaveLength(2);
    for (const user of byIds) {
      expect(Object.keys(user).sort()).toEqual(['fullName', 'id', 'status']);
    }

    const byEmails = await userReader.findByEmails([
      'ANA.TORRES@example.test',
      'rosa.vega@example.test',
    ]);
    expect(byEmails.get('ana.torres@example.test')).toEqual({
      id: 'usr-1',
      fullName: 'Ana Torres Quispe',
      status: 'ACTIVE',
    });
    expect(byEmails.get('rosa.vega@example.test')).toEqual({
      id: 'usr-3',
      fullName: 'Rosa Vega Díaz',
      status: 'INACTIVE',
    });
  }, 5_000);

  it('replaces the previous set', async () => {
    await seedCommitteeAndUsers();

    await uow.run(() =>
      memberRepository.createMany({
        committeeId: 'com-2027',
        entries: [
          { fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT', userId: 'usr-1' },
          { fullName: 'Carlos Méndez', degree: 'Mg.', position: 'MEMBER', userId: null },
        ],
        actorId: 'usr-1',
        now: NOW,
      }),
    );

    const replaced = await uow.run(() =>
      memberRepository.replaceForCommittee({
        committeeId: 'com-2027',
        entries: [
          { fullName: 'Luis Rojas', degree: 'Dr.', position: 'PRESIDENT', userId: 'usr-2' },
        ],
        actorId: 'usr-2',
        now: NOW,
      }),
    );

    expect(replaced).toHaveLength(1);
    expect(replaced[0]?.fullName).toBe('Luis Rojas');
    expect(replaced[0]?.userId).toBe('usr-2');
    expect(replaced[0]?.position).toBe('PRESIDENT');
  }, 5_000);

  it('rejects a user linked twice in the same committee', async () => {
    await seedCommitteeAndUsers();

    await expect(
      uow.run(() =>
        memberRepository.createMany({
          committeeId: 'com-2027',
          entries: [
            { fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT', userId: 'usr-1' },
            {
              fullName: 'Ana Torres Duplicada',
              degree: 'Dr.',
              position: 'MEMBER',
              userId: 'usr-1',
            },
          ],
          actorId: 'usr-1',
          now: NOW,
        }),
      ),
    ).rejects.toBeInstanceOf(InvalidQualityCommitteeDataError);
  }, 5_000);

  it('keeps one coherent member set under concurrent replacements', async () => {
    await seedCommitteeAndUsers();

    const setA = [
      { fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT' as const, userId: 'usr-1' },
      { fullName: 'Carlos Méndez', degree: 'Mg.', position: 'MEMBER' as const, userId: null },
    ];
    const setB = [
      { fullName: 'Luis Rojas', degree: 'Dr.', position: 'PRESIDENT' as const, userId: 'usr-2' },
    ];

    const results = await Promise.all([
      uow.run(async () => {
        await committeeRepository.findByIdForUpdate('com-2027');
        return memberRepository.replaceForCommittee({
          committeeId: 'com-2027',
          entries: setA,
          actorId: 'usr-1',
          now: NOW,
        });
      }),
      uow.run(async () => {
        await committeeRepository.findByIdForUpdate('com-2027');
        return memberRepository.replaceForCommittee({
          committeeId: 'com-2027',
          entries: setB,
          actorId: 'usr-2',
          now: NOW,
        });
      }),
    ]);

    expect(results).toHaveLength(2);

    const finalRows = await memberRepository.listByCommittee('com-2027');
    const finalSnapshot = finalRows.map((row) => ({
      fullName: row.fullName,
      degree: row.degree,
      position: row.position,
      userId: row.userId,
    }));

    expect(finalRows.filter((row) => row.position === 'PRESIDENT')).toHaveLength(1);
    const matchesSetA = JSON.stringify(finalSnapshot) === JSON.stringify(setA);
    const matchesSetB = JSON.stringify(finalSnapshot) === JSON.stringify(setB);
    expect(matchesSetA || matchesSetB).toBe(true);
  }, 5_000);
});
