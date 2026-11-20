import type { QualityCommitteeDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { CommitteeProgramNotFoundError } from '../domain/errors/index.js';
import { assertNoOverlap } from '../domain/policies/committee-composition.js';
import { assertValidPeriod, todayInLima } from '../domain/policies/committee-period.js';
import type {
  CommitteeMemberRepository,
  CommitteePermissionChecker,
  CommitteeProgramResolver,
  CommitteeUserReader,
  QualityCommitteeRepository,
} from '../domain/ports/index.js';
import { buildQualityCommitteeDto, snapshotCommittee } from './committee-dto.js';
import type { RegisterQualityCommitteeCommand } from './register-quality-committee.types.js';
import { resolveCommitteeMembers } from './resolve-member-links.js';

export interface RegisterQualityCommitteeDependencies {
  readonly qualityCommitteeRepository: QualityCommitteeRepository;
  readonly committeeMemberRepository: CommitteeMemberRepository;
  readonly programResolver: CommitteeProgramResolver;
  readonly committeeUserReader: CommitteeUserReader;
  readonly permissionChecker: CommitteePermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly clock?: () => Date;
}

/**
 * Registers a Quality Committee for a non-overlapping period with its members in an atomic,
 * audited transaction (HU-025, RF-025, RS-034, RS-002, RS-020).
 */
export class RegisterQualityCommitteeUseCase {
  private readonly clock: () => Date;

  constructor(private readonly deps: RegisterQualityCommitteeDependencies) {
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: RegisterQualityCommitteeCommand): Promise<QualityCommitteeDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'comite.editar',
      scope: 'GLOBAL',
    });

    return await this.deps.unitOfWork.run(async () => {
      const programId = await this.deps.programResolver.getCurrentProgramId();
      if (!programId) {
        throw new CommitteeProgramNotFoundError();
      }

      await this.deps.qualityCommitteeRepository.lockProgram(programId);

      const period = assertValidPeriod(command.periodStart, command.periodEnd);
      const { entries, usersById } = await resolveCommitteeMembers({
        members: command.members,
        committeeUserReader: this.deps.committeeUserReader,
      });

      const existing = await this.deps.qualityCommitteeRepository.listByProgram(programId);
      assertNoOverlap({ period, existing });

      const now = this.clock();
      const committee = await this.deps.qualityCommitteeRepository.create({
        programId,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        actorId: command.actorId,
        now,
      });

      const savedMembers = await this.deps.committeeMemberRepository.createMany({
        committeeId: committee.id,
        entries,
        actorId: command.actorId,
        now,
      });

      await this.deps.auditLogger.log({
        action: 'CREATE',
        entity: 'QualityCommittee',
        entityId: committee.id,
        actor: command.actorId,
        ip: command.ip ?? undefined,
        requestId: command.requestId ?? undefined,
        before: null,
        after: snapshotCommittee(committee, savedMembers),
      });

      return buildQualityCommitteeDto({
        committee,
        members: savedMembers,
        usersById,
        today: todayInLima(now),
      });
    });
  }
}
