import {
  currentQualityCommitteeResponseSchema,
  type CurrentQualityCommitteeResponse,
} from '@sigoa/shared';
import { todayInLima } from '../domain/policies/committee-period.js';
import { computePresidentAlerts } from '../domain/policies/president-alert.js';
import type {
  CommitteeMemberRepository,
  CommitteePermissionChecker,
  CommitteePresidentRoleReader,
  CommitteeProgramResolver,
  CommitteeUserReader,
  QualityCommitteeRepository,
} from '../domain/ports/index.js';
import { buildQualityCommitteeDto } from './committee-dto.js';
import type { GetCurrentQualityCommitteeQuery } from './get-current-quality-committee.types.js';

export interface GetCurrentQualityCommitteeDependencies {
  readonly qualityCommitteeRepository: QualityCommitteeRepository;
  readonly committeeMemberRepository: CommitteeMemberRepository;
  readonly programResolver: CommitteeProgramResolver;
  readonly committeeUserReader: CommitteeUserReader;
  readonly presidentRoleReader: CommitteePresidentRoleReader;
  readonly permissionChecker: CommitteePermissionChecker;
  readonly clock?: () => Date;
}

/**
 * Returns the currently active Quality Committee, the actor's membership status,
 * and active President role alerts without auditing (HU-025, RF-025, RS-017, RS-034).
 */
export class GetCurrentQualityCommitteeUseCase {
  private readonly clock: () => Date;

  constructor(private readonly deps: GetCurrentQualityCommitteeDependencies) {
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(query: GetCurrentQualityCommitteeQuery): Promise<CurrentQualityCommitteeResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: query.actorId,
      permission: 'comite.ver',
      scope: 'GLOBAL',
    });

    const [programId, roleHolders] = await Promise.all([
      this.deps.programResolver.getCurrentProgramId(),
      this.deps.presidentRoleReader.listActiveHolders(),
    ]);

    if (!programId) {
      return currentQualityCommitteeResponseSchema.parse({
        committee: null,
        actorMembership: null,
        alerts: computePresidentAlerts({ roleHolders, committeeMembers: null }),
      });
    }

    const today = todayInLima(this.clock());
    const committee = await this.deps.qualityCommitteeRepository.findInForce(programId, today);

    if (!committee) {
      return currentQualityCommitteeResponseSchema.parse({
        committee: null,
        actorMembership: null,
        alerts: computePresidentAlerts({ roleHolders, committeeMembers: null }),
      });
    }

    const members = await this.deps.committeeMemberRepository.listByCommittee(committee.id);
    const linkedUserIds = members
      .map((member) => member.userId)
      .filter((id): id is string => id !== null);

    const users =
      linkedUserIds.length > 0 ? await this.deps.committeeUserReader.findByIds(linkedUserIds) : [];
    const usersById = new Map(users.map((user) => [user.id, user]));

    const actorMember = members.find((member) => member.userId === query.actorId) ?? null;
    const actorMembership = actorMember
      ? { memberId: actorMember.id, position: actorMember.position }
      : null;

    const alerts = computePresidentAlerts({
      roleHolders,
      committeeMembers: members,
    });

    return currentQualityCommitteeResponseSchema.parse({
      committee: buildQualityCommitteeDto({
        committee,
        members,
        usersById,
        today,
      }),
      actorMembership,
      alerts,
    });
  }
}
