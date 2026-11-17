import { randomUUID } from 'node:crypto';
import {
  copyStakeholderListResponseSchema,
  type CopyStakeholderListResponse,
  type CopyStakeholderListSkippedItem,
} from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { StakeholderListMember } from '../domain/entities/stakeholder-list-member.js';
import { StakeholderList } from '../domain/entities/stakeholder-list.js';
import {
  IncompleteListMemberError,
  InvalidStakeholderListDataError,
  StakeholderListNotFoundError,
} from '../domain/errors/index.js';
import type { StakeholderListMemberRepository } from '../domain/ports/stakeholder-list-member-repository.js';
import type { StakeholderListRepository } from '../domain/ports/stakeholder-list-repository.js';
import type { StakeholderLookup } from '../domain/ports/stakeholder-lookup.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import type { CopyStakeholderListToNewYearCommand } from './copy-stakeholder-list-to-new-year.types.js';
import { mapStakeholderListToDto } from './stakeholder-list-dto.js';

export interface CopyStakeholderListToNewYearDependencies {
  readonly stakeholderListRepository: StakeholderListRepository;
  readonly stakeholderListMemberRepository: StakeholderListMemberRepository;
  readonly stakeholderLookup: StakeholderLookup;
  readonly permissionChecker: StakeholderPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly idGenerator?: () => string;
  readonly clock?: () => Date;
}

/**
 * Copia una lista del Anexo 3 hacia un nuevo año posterior, refrescando cada instantánea
 * desde el registro maestro y omitiendo constituyentes anulados o incompletos (HU-022, CA3,
 * RF-022, RS-037, RS-020).
 */
export class CopyStakeholderListToNewYearUseCase {
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(private readonly deps: CopyStakeholderListToNewYearDependencies) {
    this.idGenerator = deps.idGenerator ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(
    command: CopyStakeholderListToNewYearCommand,
  ): Promise<CopyStakeholderListResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'constituyente.editar',
      scope: 'GLOBAL',
    });

    const now = this.clock();

    return await this.deps.unitOfWork.run(async () => {
      const sourceList = await this.deps.stakeholderListRepository.findById(command.sourceListId);
      if (!sourceList) {
        throw new StakeholderListNotFoundError();
      }

      if (command.year <= sourceList.year) {
        throw new InvalidStakeholderListDataError(
          'El año destino debe ser posterior al año de la lista origen.',
        );
      }

      const sourceMembers = await this.deps.stakeholderListMemberRepository.listByListId(
        sourceList.id,
      );
      const stakeholders = await this.deps.stakeholderLookup.findByIds(
        sourceMembers.map((member) => member.stakeholderId),
      );
      const stakeholderById = new Map(stakeholders.map((item) => [item.id, item]));

      const targetList = StakeholderList.create({
        id: this.idGenerator(),
        programId: sourceList.programId,
        type: sourceList.type,
        year: command.year,
        studyPlanNumber: sourceList.studyPlanNumber,
        version: sourceList.version,
        actorId: command.actorId,
        now,
      });

      const copiedMembers: StakeholderListMember[] = [];
      const skipped: CopyStakeholderListSkippedItem[] = [];

      for (const sourceMember of sourceMembers) {
        const stakeholder = stakeholderById.get(sourceMember.stakeholderId);
        if (!stakeholder || stakeholder.status === 'VOIDED') {
          skipped.push({
            stakeholderId: sourceMember.stakeholderId,
            fullName: sourceMember.fullName,
            reason: 'VOIDED',
          });
          continue;
        }

        try {
          const copied = StakeholderListMember.create({
            id: this.idGenerator(),
            list: targetList,
            stakeholder,
            details: {
              activity: sourceMember.activity,
              representative: sourceMember.representative,
            },
            actorId: command.actorId,
            now,
          });
          copiedMembers.push(copied);
        } catch (error) {
          if (
            error instanceof IncompleteListMemberError ||
            error instanceof InvalidStakeholderListDataError
          ) {
            skipped.push({
              stakeholderId: sourceMember.stakeholderId,
              fullName: stakeholder.fullName,
              reason: 'INCOMPLETE',
            });
            continue;
          }
          throw error;
        }
      }

      await this.deps.stakeholderListRepository.save(targetList);
      await this.deps.stakeholderListMemberRepository.addMany(copiedMembers);

      await this.deps.auditLogger.log({
        action: 'CREATE',
        entity: 'StakeholderList',
        entityId: targetList.id,
        actor: command.actorId,
        ip: command.ip ?? undefined,
        before: null,
        after: {
          ...targetList.snapshot(),
          copiedFromListId: sourceList.id,
          memberCount: copiedMembers.length,
        },
      });

      for (const member of copiedMembers) {
        await this.deps.auditLogger.log({
          action: 'CREATE',
          entity: 'StakeholderListMember',
          entityId: member.id,
          actor: command.actorId,
          ip: command.ip ?? undefined,
          before: null,
          after: member.snapshot(),
        });
      }

      return copyStakeholderListResponseSchema.parse({
        list: mapStakeholderListToDto(targetList, copiedMembers.length, copiedMembers),
        skipped,
      });
    });
  }
}
