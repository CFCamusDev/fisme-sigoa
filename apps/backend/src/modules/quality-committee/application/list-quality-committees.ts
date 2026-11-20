import {
  qualityCommitteeListResponseSchema,
  type QualityCommitteeListResponse,
} from '@sigoa/shared';
import type { CommitteeMember } from '../domain/entities/committee-member.js';
import { todayInLima } from '../domain/policies/committee-period.js';
import type {
  CommitteeMemberRepository,
  CommitteePermissionChecker,
  CommitteeProgramResolver,
  CommitteeUserReader,
  QualityCommitteeRepository,
} from '../domain/ports/index.js';
import { buildQualityCommitteeDto } from './committee-dto.js';
import type { ListQualityCommitteesQuery } from './list-quality-committees.types.js';

export interface ListQualityCommitteesDependencies {
  readonly qualityCommitteeRepository: QualityCommitteeRepository;
  readonly committeeMemberRepository: CommitteeMemberRepository;
  readonly programResolver: CommitteeProgramResolver;
  readonly committeeUserReader: CommitteeUserReader;
  readonly permissionChecker: CommitteePermissionChecker;
  readonly clock?: () => Date;
}

/**
 * Lists Quality Committees paginated from newest to oldest period with their members
 * and `isCurrent` flag (HU-025, T-025-15 D7, RN-062).
 */
export class ListQualityCommitteesUseCase {
  private readonly clock: () => Date;

  constructor(private readonly deps: ListQualityCommitteesDependencies) {
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(query: ListQualityCommitteesQuery): Promise<QualityCommitteeListResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: query.actorId,
      permission: 'comite.ver',
      scope: 'GLOBAL',
    });

    const programId = await this.deps.programResolver.getCurrentProgramId();
    if (!programId) {
      return qualityCommitteeListResponseSchema.parse({
        items: [],
        page: query.page,
        pageSize: query.pageSize,
        total: 0,
      });
    }

    const { items: committees, total } = await this.deps.qualityCommitteeRepository.listPage({
      programId,
      page: query.page,
      pageSize: query.pageSize,
    });

    if (committees.length === 0) {
      return qualityCommitteeListResponseSchema.parse({
        items: [],
        page: query.page,
        pageSize: query.pageSize,
        total,
      });
    }

    const committeeIds = committees.map((committee) => committee.id);
    const allMembers = await this.deps.committeeMemberRepository.listByCommittees(committeeIds);

    const linkedUserIds = allMembers
      .map((member) => member.userId)
      .filter((id): id is string => id !== null);
    const users =
      linkedUserIds.length > 0 ? await this.deps.committeeUserReader.findByIds(linkedUserIds) : [];
    const usersById = new Map(users.map((user) => [user.id, user]));

    const membersByCommittee = new Map<string, CommitteeMember[]>();
    for (const member of allMembers) {
      const group = membersByCommittee.get(member.committeeId);
      if (group) {
        group.push(member);
      } else {
        membersByCommittee.set(member.committeeId, [member]);
      }
    }

    const today = todayInLima(this.clock());

    return qualityCommitteeListResponseSchema.parse({
      items: committees.map((committee) =>
        buildQualityCommitteeDto({
          committee,
          members: membersByCommittee.get(committee.id) ?? [],
          usersById,
          today,
        }),
      ),
      page: query.page,
      pageSize: query.pageSize,
      total,
    });
  }
}
