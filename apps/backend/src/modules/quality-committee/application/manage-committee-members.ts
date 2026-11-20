import type { QualityCommitteeDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { QualityCommitteeNotFoundError } from '../domain/errors/index.js';
import { assertCommitteeEditable } from '../domain/policies/committee-composition.js';
import { todayInLima } from '../domain/policies/committee-period.js';
import type {
  CommitteeMemberRepository,
  CommitteePermissionChecker,
  CommitteeUserReader,
  QualityCommitteeRepository,
} from '../domain/ports/index.js';
import {
  buildQualityCommitteeDto,
  snapshotCommittee,
  snapshotCommitteeMembers,
} from './committee-dto.js';
import type { ManageCommitteeMembersCommand } from './manage-committee-members.types.js';
import { resolveCommitteeMembers } from './resolve-member-links.js';

export interface ManageCommitteeMembersDependencies {
  readonly qualityCommitteeRepository: QualityCommitteeRepository;
  readonly committeeMemberRepository: CommitteeMemberRepository;
  readonly committeeUserReader: CommitteeUserReader;
  readonly permissionChecker: CommitteePermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly clock?: () => Date;
}

/**
 * Replaces the full member set of an active or future Quality Committee in an idempotent,
 * atomic, audited transaction (HU-025, RF-025, RN-062, RS-002, RS-020).
 */
export class ManageCommitteeMembersUseCase {
  private readonly clock: () => Date;

  constructor(private readonly deps: ManageCommitteeMembersDependencies) {
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: ManageCommitteeMembersCommand): Promise<QualityCommitteeDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'comite.editar',
      scope: 'GLOBAL',
    });

    return await this.deps.unitOfWork.run(async () => {
      const committee = await this.deps.qualityCommitteeRepository.findByIdForUpdate(
        command.committeeId,
      );
      if (!committee) {
        throw new QualityCommitteeNotFoundError(command.committeeId);
      }

      const now = this.clock();
      const today = todayInLima(now);
      assertCommitteeEditable({ period: committee, today });

      const { entries, usersById } = await resolveCommitteeMembers({
        members: command.members,
        committeeUserReader: this.deps.committeeUserReader,
      });

      const currentMembers = await this.deps.committeeMemberRepository.listByCommittee(
        committee.id,
      );
      const beforeMembersSnapshot = snapshotCommitteeMembers(currentMembers);
      const targetMembersSnapshot = snapshotCommitteeMembers(entries);

      if (JSON.stringify(beforeMembersSnapshot) === JSON.stringify(targetMembersSnapshot)) {
        return buildQualityCommitteeDto({
          committee,
          members: currentMembers,
          usersById,
          today,
        });
      }

      const savedMembers = await this.deps.committeeMemberRepository.replaceForCommittee({
        committeeId: committee.id,
        entries,
        actorId: command.actorId,
        now,
      });

      const updatedCommittee = await this.deps.qualityCommitteeRepository.touch(
        committee.id,
        command.actorId,
        now,
      );

      await this.deps.auditLogger.log({
        action: 'UPDATE',
        entity: 'QualityCommittee',
        entityId: committee.id,
        actor: command.actorId,
        ip: command.ip ?? undefined,
        before: snapshotCommittee(committee, currentMembers),
        after: snapshotCommittee(updatedCommittee, savedMembers),
      });

      return buildQualityCommitteeDto({
        committee: updatedCommittee,
        members: savedMembers,
        usersById,
        today,
      });
    });
  }
}
