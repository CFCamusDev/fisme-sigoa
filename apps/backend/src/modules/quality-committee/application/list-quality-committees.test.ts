import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { QualityCommittee } from '../domain/entities/quality-committee.js';
import type {
  CommitteeMemberRepository,
  CommitteePermissionChecker,
  CommitteeProgramResolver,
  CommitteeUserReader,
  QualityCommitteeRepository,
} from '../domain/ports/index.js';
import { ListQualityCommitteesUseCase } from './list-quality-committees.js';

describe('ListQualityCommitteesUseCase (T-025-15)', () => {
  let qualityCommitteeRepository: MockProxy<QualityCommitteeRepository>;
  let committeeMemberRepository: MockProxy<CommitteeMemberRepository>;
  let programResolver: MockProxy<CommitteeProgramResolver>;
  let committeeUserReader: MockProxy<CommitteeUserReader>;
  let permissionChecker: MockProxy<CommitteePermissionChecker>;
  let useCase: ListQualityCommitteesUseCase;

  const FIXED_NOW = new Date('2027-06-15T15:00:00.000Z');
  const COMMITTEES: readonly QualityCommittee[] = [
    {
      id: 'com-2028',
      programId: 'prog-1',
      periodStart: '2028-01-01',
      periodEnd: '2028-12-31',
      createdBy: 'actor-0',
      updatedBy: null,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
    {
      id: 'com-2027',
      programId: 'prog-1',
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      createdBy: 'actor-0',
      updatedBy: null,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
    {
      id: 'com-2026',
      programId: 'prog-1',
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      createdBy: 'actor-0',
      updatedBy: null,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
  ];

  beforeEach(() => {
    qualityCommitteeRepository = mock<QualityCommitteeRepository>();
    committeeMemberRepository = mock<CommitteeMemberRepository>();
    programResolver = mock<CommitteeProgramResolver>();
    committeeUserReader = mock<CommitteeUserReader>();
    permissionChecker = mock<CommitteePermissionChecker>();

    permissionChecker.assertAllowed.mockResolvedValue(undefined);
    programResolver.getCurrentProgramId.mockResolvedValue('prog-1');
    qualityCommitteeRepository.listPage.mockResolvedValue({
      items: COMMITTEES,
      total: 3,
    });
    committeeMemberRepository.listByCommittees.mockResolvedValue([
      {
        id: 'mem-2027-1',
        committeeId: 'com-2027',
        fullName: 'Ana Torres',
        degree: 'Dr.',
        position: 'PRESIDENT',
        userId: 'usr-1',
        createdBy: 'actor-0',
        createdAt: FIXED_NOW,
      },
    ]);
    committeeUserReader.findByIds.mockResolvedValue([
      { id: 'usr-1', fullName: 'Ana Torres Quispe', status: 'ACTIVE' },
    ]);

    useCase = new ListQualityCommitteesUseCase({
      qualityCommitteeRepository,
      committeeMemberRepository,
      programResolver,
      committeeUserReader,
      permissionChecker,
      clock: () => FIXED_NOW,
    });
  });

  it('lists the history from the newest period', async () => {
    const result = await useCase.execute({ actorId: 'usr-1', page: 1, pageSize: 10 });

    expect(result.total).toBe(3);
    expect(result.items.map((item) => item.id)).toEqual(['com-2028', 'com-2027', 'com-2026']);
    expect(result.items[1]?.members[0]?.linkedUserName).toBe('Ana Torres Quispe');
  });

  it('marks the committee in force', async () => {
    const result = await useCase.execute({ actorId: 'usr-1', page: 1, pageSize: 10 });

    expect(result.items.map((item) => item.isCurrent)).toEqual([false, true, false]);
  });

  it('throws forbidden without comite.ver', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError('Sin permiso'));

    await expect(
      useCase.execute({ actorId: 'usr-denied', page: 1, pageSize: 10 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(qualityCommitteeRepository.listPage).not.toHaveBeenCalled();
  });

  it('returns an empty page out of range or when no program exists', async () => {
    qualityCommitteeRepository.listPage.mockResolvedValue({ items: [], total: 3 });

    const outOfRange = await useCase.execute({ actorId: 'usr-1', page: 5, pageSize: 10 });
    expect(outOfRange).toEqual({ items: [], page: 5, pageSize: 10, total: 3 });

    programResolver.getCurrentProgramId.mockResolvedValue(null);
    const noProgram = await useCase.execute({ actorId: 'usr-1', page: 1, pageSize: 10 });
    expect(noProgram).toEqual({ items: [], page: 1, pageSize: 10, total: 0 });
  });
});
