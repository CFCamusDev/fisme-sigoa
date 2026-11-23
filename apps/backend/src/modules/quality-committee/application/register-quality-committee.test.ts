import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import {
  CommitteeMemberUserNotFoundError,
  CommitteeProgramNotFoundError,
  InvalidQualityCommitteeDataError,
  QualityCommitteeOverlapError,
} from '../domain/errors/index.js';
import type {
  CommitteeMemberRepository,
  CommitteePermissionChecker,
  CommitteeProgramResolver,
  CommitteeUserReader,
  QualityCommitteeRepository,
} from '../domain/ports/index.js';
import { RegisterQualityCommitteeUseCase } from './register-quality-committee.js';

describe('RegisterQualityCommitteeUseCase (T-025-20)', () => {
  let qualityCommitteeRepository: MockProxy<QualityCommitteeRepository>;
  let committeeMemberRepository: MockProxy<CommitteeMemberRepository>;
  let programResolver: MockProxy<CommitteeProgramResolver>;
  let committeeUserReader: MockProxy<CommitteeUserReader>;
  let permissionChecker: MockProxy<CommitteePermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: RegisterQualityCommitteeUseCase;

  const FIXED_NOW = new Date('2027-03-15T15:00:00.000Z');

  beforeEach(() => {
    qualityCommitteeRepository = mock<QualityCommitteeRepository>();
    committeeMemberRepository = mock<CommitteeMemberRepository>();
    programResolver = mock<CommitteeProgramResolver>();
    committeeUserReader = mock<CommitteeUserReader>();
    permissionChecker = mock<CommitteePermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();

    permissionChecker.assertAllowed.mockResolvedValue(undefined);
    unitOfWork.run.mockImplementation(async (work) => work());
    programResolver.getCurrentProgramId.mockResolvedValue('prog-1');
    qualityCommitteeRepository.lockProgram.mockResolvedValue(undefined);
    qualityCommitteeRepository.listByProgram.mockResolvedValue([]);
    committeeUserReader.findByIds.mockResolvedValue([]);
    committeeUserReader.findByEmails.mockResolvedValue(new Map());
    auditLogger.log.mockResolvedValue(undefined);

    qualityCommitteeRepository.create.mockImplementation(async (input) => ({
      id: 'com-2027',
      programId: input.programId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      createdBy: input.actorId,
      updatedBy: null,
      createdAt: input.now,
      updatedAt: input.now,
    }));

    committeeMemberRepository.createMany.mockImplementation(async (input) =>
      input.entries.map((entry, index) => ({
        id: `mem-${index + 1}`,
        committeeId: input.committeeId,
        fullName: entry.fullName,
        degree: entry.degree,
        position: entry.position,
        userId: entry.userId,
        createdBy: input.actorId,
        createdAt: input.now,
      })),
    );

    useCase = new RegisterQualityCommitteeUseCase({
      qualityCommitteeRepository,
      committeeMemberRepository,
      programResolver,
      committeeUserReader,
      permissionChecker,
      unitOfWork,
      auditLogger,
      clock: () => FIXED_NOW,
    });
  });

  it('registers the committee with its members and audits it', async () => {
    const result = await useCase.execute({
      actorId: 'actor-1',
      ip: '127.0.0.1',
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      members: [
        { fullName: '  Ana Torres  ', degree: '  Dr.  ', position: 'PRESIDENT' },
        { fullName: 'Luis Rojas', degree: 'Mg.', position: 'MEMBER' },
      ],
    });

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'actor-1',
      permission: 'comite.editar',
      scope: 'GLOBAL',
    });
    expect(qualityCommitteeRepository.lockProgram).toHaveBeenCalledWith('prog-1');
    expect(qualityCommitteeRepository.create).toHaveBeenCalledWith({
      programId: 'prog-1',
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      actorId: 'actor-1',
      now: FIXED_NOW,
    });
    expect(committeeMemberRepository.createMany).toHaveBeenCalledTimes(1);
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'QualityCommittee',
        entityId: 'com-2027',
        actor: 'actor-1',
        ip: '127.0.0.1',
        before: null,
      }),
    );

    expect(result).toEqual({
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
          userId: null,
          linkedUserName: null,
        },
        {
          id: 'mem-2',
          fullName: 'Luis Rojas',
          degree: 'Mg.',
          position: 'MEMBER',
          userId: null,
          linkedUserName: null,
        },
      ],
    });
  });

  it('throws forbidden without comite.editar', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError('Sin permiso'));

    await expect(
      useCase.execute({
        actorId: 'actor-2',
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
        members: [{ fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT' }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(qualityCommitteeRepository.create).not.toHaveBeenCalled();
  });

  it('rejects an overlapping period', async () => {
    qualityCommitteeRepository.listByProgram.mockResolvedValue([
      {
        id: 'com-existing',
        programId: 'prog-1',
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
        createdBy: 'actor-0',
        updatedBy: null,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      },
    ]);

    await expect(
      useCase.execute({
        actorId: 'actor-1',
        periodStart: '2027-06-01',
        periodEnd: '2028-05-31',
        members: [{ fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT' }],
      }),
    ).rejects.toBeInstanceOf(QualityCommitteeOverlapError);

    expect(qualityCommitteeRepository.create).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects when the program does not exist', async () => {
    programResolver.getCurrentProgramId.mockResolvedValue(null);

    await expect(
      useCase.execute({
        actorId: 'actor-1',
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
        members: [{ fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT' }],
      }),
    ).rejects.toBeInstanceOf(CommitteeProgramNotFoundError);
  });

  it('links a member by email to an active user', async () => {
    committeeUserReader.findByEmails.mockResolvedValue(
      new Map([
        [
          'ana.torres@example.test',
          { id: 'usr-1', fullName: 'Ana Torres Quispe', status: 'ACTIVE' },
        ],
      ]),
    );

    const result = await useCase.execute({
      actorId: 'actor-1',
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      members: [
        {
          fullName: 'Ana Torres',
          degree: 'Dr.',
          position: 'PRESIDENT',
          userEmail: 'ANA.TORRES@example.test',
        },
      ],
    });

    expect(result.members[0]?.userId).toBe('usr-1');
    expect(result.members[0]?.linkedUserName).toBe('Ana Torres Quispe');
  });

  it('rejects a member linked to an unknown or inactive user', async () => {
    committeeUserReader.findByIds.mockResolvedValue([
      { id: 'usr-inactive', fullName: 'Rosa Vega', status: 'INACTIVE' },
    ]);

    await expect(
      useCase.execute({
        actorId: 'actor-1',
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
        members: [
          {
            fullName: 'Rosa Vega',
            degree: 'Dr.',
            position: 'PRESIDENT',
            userId: 'usr-inactive',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(CommitteeMemberUserNotFoundError);

    await expect(
      useCase.execute({
        actorId: 'actor-1',
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
        members: [
          {
            fullName: 'Desconocido',
            degree: 'Dr.',
            position: 'PRESIDENT',
            userId: 'usr-missing',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(CommitteeMemberUserNotFoundError);
  });

  it('uses the same message for an unknown email and an inactive user', async () => {
    committeeUserReader.findByEmails
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(
        new Map([
          [
            'inactivo@example.test',
            { id: 'usr-inactive', fullName: 'Usuario Inactivo', status: 'INACTIVE' },
          ],
        ]),
      );

    let unknownMessage = '';
    try {
      await useCase.execute({
        actorId: 'actor-1',
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
        members: [
          {
            fullName: 'Alguien',
            degree: 'Dr.',
            position: 'PRESIDENT',
            userEmail: 'nadie@example.test',
          },
        ],
      });
    } catch (error) {
      unknownMessage = error instanceof Error ? error.message : '';
    }

    let inactiveMessage = '';
    try {
      await useCase.execute({
        actorId: 'actor-1',
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
        members: [
          {
            fullName: 'Inactivo',
            degree: 'Dr.',
            position: 'PRESIDENT',
            userEmail: 'inactivo@example.test',
          },
        ],
      });
    } catch (error) {
      inactiveMessage = error instanceof Error ? error.message : '';
    }

    expect(unknownMessage).toBe(
      'No existe un usuario activo con el correo nadie@example.test. Revisa el correo o deja el vínculo vacío.',
    );
    expect(inactiveMessage).toBe(
      'No existe un usuario activo con el correo inactivo@example.test. Revisa el correo o deja el vínculo vacío.',
    );
  });

  it('rejects duplicate resolved user across userId and userEmail or both on the same member', async () => {
    await expect(
      useCase.execute({
        actorId: 'actor-1',
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
        members: [
          {
            fullName: 'Ana Torres',
            degree: 'Dr.',
            position: 'PRESIDENT',
            userId: 'usr-1',
            userEmail: 'ana.torres@example.test',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidQualityCommitteeDataError);

    committeeUserReader.findByIds.mockResolvedValue([
      { id: 'usr-1', fullName: 'Ana Torres', status: 'ACTIVE' },
    ]);
    committeeUserReader.findByEmails.mockResolvedValue(
      new Map([
        ['ana.torres@example.test', { id: 'usr-1', fullName: 'Ana Torres', status: 'ACTIVE' }],
      ]),
    );

    await expect(
      useCase.execute({
        actorId: 'actor-1',
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
        members: [
          { fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT', userId: 'usr-1' },
          {
            fullName: 'Ana Duplicada',
            degree: 'Dr.',
            position: 'MEMBER',
            userEmail: 'ana.torres@example.test',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidQualityCommitteeDataError);
  });

  it('does not persist when the audit fails', async () => {
    let committed = false;
    unitOfWork.run.mockImplementation(async (work) => {
      const output = await work();
      committed = true;
      return output;
    });
    auditLogger.log.mockRejectedValue(new Error('Audit chain unavailable'));

    await expect(
      useCase.execute({
        actorId: 'actor-1',
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
        members: [{ fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT' }],
      }),
    ).rejects.toThrow('Audit chain unavailable');

    expect(committed).toBe(false);
  });

  it('returns a DTO without email', async () => {
    committeeUserReader.findByEmails.mockResolvedValue(
      new Map([
        [
          'ana.torres@example.test',
          { id: 'usr-1', fullName: 'Ana Torres Quispe', status: 'ACTIVE' },
        ],
      ]),
    );

    const result = await useCase.execute({
      actorId: 'actor-1',
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      members: [
        {
          fullName: 'Ana Torres',
          degree: 'Dr.',
          position: 'PRESIDENT',
          userEmail: 'ana.torres@example.test',
        },
      ],
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('ana.torres@example.test');
    expect(Object.keys(result.members[0]!).sort()).toEqual([
      'degree',
      'fullName',
      'id',
      'linkedUserName',
      'position',
      'userId',
    ]);
  });
});
