import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import type { CommitteeMember } from '../domain/entities/committee-member.js';
import type { QualityCommittee } from '../domain/entities/quality-committee.js';
import {
  InvalidQualityCommitteeDataError,
  QualityCommitteeClosedError,
  QualityCommitteeNotFoundError,
} from '../domain/errors/index.js';
import type {
  CommitteeMemberRepository,
  CommitteePermissionChecker,
  CommitteeUserReader,
  QualityCommitteeRepository,
} from '../domain/ports/index.js';
import { ManageCommitteeMembersUseCase } from './manage-committee-members.js';

describe('ManageCommitteeMembersUseCase (T-025-21)', () => {
  let qualityCommitteeRepository: MockProxy<QualityCommitteeRepository>;
  let committeeMemberRepository: MockProxy<CommitteeMemberRepository>;
  let committeeUserReader: MockProxy<CommitteeUserReader>;
  let permissionChecker: MockProxy<CommitteePermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: ManageCommitteeMembersUseCase;

  const FIXED_NOW = new Date('2027-06-15T15:00:00.000Z');
  const ACTIVE_COMMITTEE: QualityCommittee = {
    id: 'com-2027',
    programId: 'prog-1',
    periodStart: '2027-01-01',
    periodEnd: '2027-12-31',
    createdBy: 'actor-0',
    updatedBy: null,
    createdAt: new Date('2026-12-01T15:00:00.000Z'),
    updatedAt: new Date('2026-12-01T15:00:00.000Z'),
  };
  const INITIAL_MEMBERS: readonly CommitteeMember[] = [
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
    committeeUserReader = mock<CommitteeUserReader>();
    permissionChecker = mock<CommitteePermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();

    permissionChecker.assertAllowed.mockResolvedValue(undefined);
    unitOfWork.run.mockImplementation(async (work) => work());
    qualityCommitteeRepository.findByIdForUpdate.mockResolvedValue(ACTIVE_COMMITTEE);
    committeeMemberRepository.listByCommittee.mockResolvedValue(INITIAL_MEMBERS);
    committeeUserReader.findByIds.mockResolvedValue([]);
    committeeUserReader.findByEmails.mockResolvedValue(new Map());
    auditLogger.log.mockResolvedValue(undefined);

    qualityCommitteeRepository.touch.mockImplementation(async (id, actorId, now) => ({
      ...ACTIVE_COMMITTEE,
      id,
      updatedBy: actorId,
      updatedAt: now,
    }));

    committeeMemberRepository.replaceForCommittee.mockImplementation(async (input) =>
      input.entries.map((entry, index) => ({
        id: `mem-new-${index + 1}`,
        committeeId: input.committeeId,
        fullName: entry.fullName,
        degree: entry.degree,
        position: entry.position,
        userId: entry.userId,
        createdBy: input.actorId,
        createdAt: input.now,
      })),
    );

    useCase = new ManageCommitteeMembersUseCase({
      qualityCommitteeRepository,
      committeeMemberRepository,
      committeeUserReader,
      permissionChecker,
      unitOfWork,
      auditLogger,
      clock: () => FIXED_NOW,
    });
  });

  it('replaces the members and audits before and after', async () => {
    committeeUserReader.findByEmails.mockResolvedValue(
      new Map([
        ['luis.rojas@example.test', { id: 'usr-2', fullName: 'Luis Rojas', status: 'ACTIVE' }],
      ]),
    );

    const result = await useCase.execute({
      actorId: 'actor-1',
      ip: '127.0.0.1',
      committeeId: 'com-2027',
      members: [
        {
          fullName: 'Luis Rojas',
          degree: 'Dr.',
          position: 'PRESIDENT',
          userEmail: 'luis.rojas@example.test',
        },
        { fullName: 'Elena Paredes', degree: 'Ing.', position: 'MEMBER' },
      ],
    });

    expect(committeeMemberRepository.replaceForCommittee).toHaveBeenCalledTimes(1);
    expect(qualityCommitteeRepository.touch).toHaveBeenCalledWith('com-2027', 'actor-1', FIXED_NOW);
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        entity: 'QualityCommittee',
        entityId: 'com-2027',
        actor: 'actor-1',
        ip: '127.0.0.1',
        before: expect.objectContaining({
          members: [
            { fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT', userId: 'usr-1' },
            { fullName: 'Carlos Méndez', degree: 'Mg.', position: 'MEMBER', userId: null },
          ],
        }),
        after: expect.objectContaining({
          members: [
            { fullName: 'Luis Rojas', degree: 'Dr.', position: 'PRESIDENT', userId: 'usr-2' },
            { fullName: 'Elena Paredes', degree: 'Ing.', position: 'MEMBER', userId: null },
          ],
        }),
      }),
    );

    expect(result.isCurrent).toBe(true);
    expect(result.members[0]?.linkedUserName).toBe('Luis Rojas');
  });

  it('throws forbidden without comite.editar', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError('Sin permiso'));

    await expect(
      useCase.execute({
        actorId: 'actor-2',
        committeeId: 'com-2027',
        members: [{ fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT' }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown committee', async () => {
    qualityCommitteeRepository.findByIdForUpdate.mockResolvedValue(null);

    await expect(
      useCase.execute({
        actorId: 'actor-1',
        committeeId: 'com-unknown',
        members: [{ fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT' }],
      }),
    ).rejects.toBeInstanceOf(QualityCommitteeNotFoundError);
  });

  it('rejects a committee whose period already ended', async () => {
    qualityCommitteeRepository.findByIdForUpdate.mockResolvedValue({
      ...ACTIVE_COMMITTEE,
      id: 'com-2026',
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
    });

    await expect(
      useCase.execute({
        actorId: 'actor-1',
        committeeId: 'com-2026',
        members: [{ fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT' }],
      }),
    ).rejects.toBeInstanceOf(QualityCommitteeClosedError);

    expect(committeeMemberRepository.replaceForCommittee).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('does not write or audit when the set is unchanged', async () => {
    committeeUserReader.findByIds.mockResolvedValue([
      { id: 'usr-1', fullName: 'Ana Torres Quispe', status: 'ACTIVE' },
    ]);

    const result = await useCase.execute({
      actorId: 'actor-1',
      committeeId: 'com-2027',
      members: [
        { fullName: 'Carlos Méndez', degree: 'Mg.', position: 'MEMBER' },
        { fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT', userId: 'usr-1' },
      ],
    });

    expect(committeeMemberRepository.replaceForCommittee).not.toHaveBeenCalled();
    expect(qualityCommitteeRepository.touch).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
    expect(result.members).toHaveLength(2);
    expect(result.members[0]?.linkedUserName).toBe('Ana Torres Quispe');
  });

  it('keeps an existing link with userId', async () => {
    committeeUserReader.findByIds.mockResolvedValue([
      { id: 'usr-1', fullName: 'Ana Torres Quispe', status: 'ACTIVE' },
    ]);

    const result = await useCase.execute({
      actorId: 'actor-1',
      committeeId: 'com-2027',
      members: [{ fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT', userId: 'usr-1' }],
    });

    expect(committeeMemberRepository.replaceForCommittee).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: [
          { fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT', userId: 'usr-1' },
        ],
      }),
    );
    expect(result.members[0]?.userId).toBe('usr-1');
    expect(result.members[0]?.linkedUserName).toBe('Ana Torres Quispe');
  });

  it('rejects two presidents', async () => {
    await expect(
      useCase.execute({
        actorId: 'actor-1',
        committeeId: 'com-2027',
        members: [
          { fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT' },
          { fullName: 'Luis Rojas', degree: 'Mg.', position: 'PRESIDENT' },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidQualityCommitteeDataError);

    expect(committeeMemberRepository.replaceForCommittee).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });
});
