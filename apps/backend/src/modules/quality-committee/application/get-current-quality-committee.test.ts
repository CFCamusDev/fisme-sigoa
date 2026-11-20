import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { CommitteeMember } from '../domain/entities/committee-member.js';
import type { QualityCommittee } from '../domain/entities/quality-committee.js';
import type {
  CommitteeMemberRepository,
  CommitteePermissionChecker,
  CommitteePresidentRoleReader,
  CommitteeProgramResolver,
  CommitteeUserReader,
  QualityCommitteeRepository,
} from '../domain/ports/index.js';
import { GetCurrentQualityCommitteeUseCase } from './get-current-quality-committee.js';

describe('GetCurrentQualityCommitteeUseCase (T-025-22)', () => {
  let qualityCommitteeRepository: MockProxy<QualityCommitteeRepository>;
  let committeeMemberRepository: MockProxy<CommitteeMemberRepository>;
  let programResolver: MockProxy<CommitteeProgramResolver>;
  let committeeUserReader: MockProxy<CommitteeUserReader>;
  let presidentRoleReader: MockProxy<CommitteePresidentRoleReader>;
  let permissionChecker: MockProxy<CommitteePermissionChecker>;
  let useCase: GetCurrentQualityCommitteeUseCase;

  const FIXED_NOW = new Date('2027-06-15T15:00:00.000Z');
  const CURRENT_COMMITTEE: QualityCommittee = {
    id: 'com-2027',
    programId: 'prog-1',
    periodStart: '2027-01-01',
    periodEnd: '2027-12-31',
    createdBy: 'actor-0',
    updatedBy: null,
    createdAt: new Date('2026-12-01T15:00:00.000Z'),
    updatedAt: new Date('2026-12-01T15:00:00.000Z'),
  };
  const MEMBERS: readonly CommitteeMember[] = [
    {
      id: 'mem-1',
      committeeId: 'com-2027',
      fullName: 'Ana Torres',
      degree: 'Dr.',
      position: 'PRESIDENT',
      userId: 'usr-1',
      createdBy: 'actor-0',
      createdAt: new Date('2026-12-01T15:00:00.000Z'),
    },
    {
      id: 'mem-2',
      committeeId: 'com-2027',
      fullName: 'Carlos Méndez',
      degree: 'Mg.',
      position: 'MEMBER',
      userId: null,
      createdBy: 'actor-0',
      createdAt: new Date('2026-12-01T15:00:00.000Z'),
    },
  ];

  beforeEach(() => {
    qualityCommitteeRepository = mock<QualityCommitteeRepository>();
    committeeMemberRepository = mock<CommitteeMemberRepository>();
    programResolver = mock<CommitteeProgramResolver>();
    committeeUserReader = mock<CommitteeUserReader>();
    presidentRoleReader = mock<CommitteePresidentRoleReader>();
    permissionChecker = mock<CommitteePermissionChecker>();

    permissionChecker.assertAllowed.mockResolvedValue(undefined);
    programResolver.getCurrentProgramId.mockResolvedValue('prog-1');
    qualityCommitteeRepository.findInForce.mockResolvedValue(CURRENT_COMMITTEE);
    committeeMemberRepository.listByCommittee.mockResolvedValue(MEMBERS);
    committeeUserReader.findByIds.mockResolvedValue([
      { id: 'usr-1', fullName: 'Ana Torres Quispe', status: 'ACTIVE' },
    ]);
    presidentRoleReader.listActiveHolders.mockResolvedValue([
      { userId: 'usr-1', fullName: 'Ana Torres Quispe' },
    ]);

    useCase = new GetCurrentQualityCommitteeUseCase({
      qualityCommitteeRepository,
      committeeMemberRepository,
      programResolver,
      committeeUserReader,
      presidentRoleReader,
      permissionChecker,
      clock: () => FIXED_NOW,
    });
  });

  it('returns the committee in force with its members', async () => {
    const result = await useCase.execute({ actorId: 'usr-other' });

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'usr-other',
      permission: 'comite.ver',
      scope: 'GLOBAL',
    });
    expect(qualityCommitteeRepository.findInForce).toHaveBeenCalledWith('prog-1', '2027-06-15');
    expect(result).toEqual({
      committee: {
        id: 'com-2027',
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
        isCurrent: true,
        members: [
          {
            id: 'mem-1',
            fullName: 'Ana Torres',
            degree: 'Dr.',
            position: 'PRESIDENT',
            userId: 'usr-1',
            linkedUserName: 'Ana Torres Quispe',
          },
          {
            id: 'mem-2',
            fullName: 'Carlos Méndez',
            degree: 'Mg.',
            position: 'MEMBER',
            userId: null,
            linkedUserName: null,
          },
        ],
      },
      actorMembership: null,
      alerts: [],
    });
  });

  it('throws forbidden without comite.ver', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError('Sin permiso'));

    await expect(useCase.execute({ actorId: 'usr-denied' })).rejects.toBeInstanceOf(ForbiddenError);
    expect(qualityCommitteeRepository.findInForce).not.toHaveBeenCalled();
  });

  it('returns null when no committee is in force or no program exists', async () => {
    qualityCommitteeRepository.findInForce.mockResolvedValue(null);

    const noCommittee = await useCase.execute({ actorId: 'usr-1' });
    expect(noCommittee).toEqual({
      committee: null,
      actorMembership: null,
      alerts: [{ userId: 'usr-1', fullName: 'Ana Torres Quispe' }],
    });

    programResolver.getCurrentProgramId.mockResolvedValue(null);
    const noProgram = await useCase.execute({ actorId: 'usr-1' });
    expect(noProgram).toEqual({
      committee: null,
      actorMembership: null,
      alerts: [{ userId: 'usr-1', fullName: 'Ana Torres Quispe' }],
    });
  });

  it('recognizes the linked actor as a current member', async () => {
    const result = await useCase.execute({ actorId: 'usr-1' });

    expect(result.actorMembership).toEqual({
      memberId: 'mem-1',
      position: 'PRESIDENT',
    });
  });

  it('returns no membership for an unlinked actor', async () => {
    const result = await useCase.execute({ actorId: 'usr-unlinked' });
    expect(result.actorMembership).toBeNull();
  });

  it('returns alerts after the period changes', async () => {
    presidentRoleReader.listActiveHolders.mockResolvedValue([
      { userId: 'usr-old', fullName: 'Pedro Salas' },
      { userId: 'usr-1', fullName: 'Ana Torres Quispe' },
    ]);

    const result = await useCase.execute({ actorId: 'usr-admin' });

    expect(result.alerts).toEqual([{ userId: 'usr-old', fullName: 'Pedro Salas' }]);
  });

  it('does not return emails', async () => {
    const result = await useCase.execute({ actorId: 'usr-1' });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('@');
    expect(Object.keys(result.committee!.members[0]!).sort()).toEqual([
      'degree',
      'fullName',
      'id',
      'linkedUserName',
      'position',
      'userId',
    ]);
  });

  it('does not audit or mutate data on read', async () => {
    await useCase.execute({ actorId: 'usr-1' });

    expect(qualityCommitteeRepository.create).not.toHaveBeenCalled();
    expect(qualityCommitteeRepository.touch).not.toHaveBeenCalled();
    expect(committeeMemberRepository.createMany).not.toHaveBeenCalled();
    expect(committeeMemberRepository.replaceForCommittee).not.toHaveBeenCalled();
  });
});
