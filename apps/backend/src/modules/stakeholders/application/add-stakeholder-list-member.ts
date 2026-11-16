import { randomUUID } from 'node:crypto';
import type { StakeholderListMemberDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { StakeholderListMember } from '../domain/entities/stakeholder-list-member.js';
import { StakeholderListNotFoundError, StakeholderNotFoundError } from '../domain/errors/index.js';
import type { StakeholderListMemberRepository } from '../domain/ports/stakeholder-list-member-repository.js';
import type { StakeholderListRepository } from '../domain/ports/stakeholder-list-repository.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import type { StakeholderRepository } from '../domain/ports/stakeholder-repository.js';
import type { AddStakeholderListMemberCommand } from './add-stakeholder-list-member.types.js';
import { buildStakeholderListMemberDto } from './stakeholder-list-dto.js';

export interface AddStakeholderListMemberDependencies {
  readonly stakeholderListRepository: StakeholderListRepository;
  readonly stakeholderListMemberRepository: StakeholderListMemberRepository;
  readonly stakeholderRepository: StakeholderRepository;
  readonly permissionChecker: StakeholderPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly idGenerator?: () => string;
  readonly clock?: () => Date;
}

/**
 * Agrega un constituyente del registro maestro a una lista del Anexo 3 guardando su instantánea
 * según el tipo de lista (HU-022, RF-022, RS-037, RS-020).
 */
export class AddStakeholderListMemberUseCase {
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(private readonly deps: AddStakeholderListMemberDependencies) {
    this.idGenerator = deps.idGenerator ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: AddStakeholderListMemberCommand): Promise<StakeholderListMemberDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'constituyente.editar',
      scope: 'GLOBAL',
    });

    return await this.deps.unitOfWork.run(async () => {
      const list = await this.deps.stakeholderListRepository.findById(command.listId);
      if (!list) {
        throw new StakeholderListNotFoundError();
      }

      const stakeholder = await this.deps.stakeholderRepository.findById(command.stakeholderId);
      if (!stakeholder) {
        throw new StakeholderNotFoundError();
      }

      const member = StakeholderListMember.create({
        id: this.idGenerator(),
        list,
        stakeholder,
        details: {
          activity: command.activity,
          representative: command.representative,
        },
        actorId: command.actorId,
        now: this.clock(),
      });

      await this.deps.stakeholderListMemberRepository.add(member);

      await this.deps.auditLogger.log({
        action: 'CREATE',
        entity: 'StakeholderListMember',
        entityId: member.id,
        actor: command.actorId,
        ip: command.ip ?? undefined,
        before: null,
        after: member.snapshot(),
      });

      return buildStakeholderListMemberDto(member);
    });
  }
}
