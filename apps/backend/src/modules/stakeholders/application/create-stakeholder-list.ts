import { randomUUID } from 'node:crypto';
import type { StakeholderListDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { StakeholderList } from '../domain/entities/stakeholder-list.js';
import { StakeholderListProgramNotConfiguredError } from '../domain/errors/index.js';
import type { StakeholderListProgramResolver } from '../domain/ports/stakeholder-list-program-resolver.js';
import type { StakeholderListRepository } from '../domain/ports/stakeholder-list-repository.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import type { CreateStakeholderListCommand } from './create-stakeholder-list.types.js';
import { buildStakeholderListDto } from './stakeholder-list-dto.js';

export interface CreateStakeholderListDependencies {
  readonly stakeholderListRepository: StakeholderListRepository;
  readonly programResolver: StakeholderListProgramResolver;
  readonly permissionChecker: StakeholderPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly idGenerator?: () => string;
  readonly clock?: () => Date;
}

/**
 * Crea una lista del Anexo 3 por tipo y año para el programa vigente (HU-022, RF-022, RS-037,
 * RS-020). La unicidad por (programId, type, year) la garantiza la base de datos.
 */
export class CreateStakeholderListUseCase {
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(private readonly deps: CreateStakeholderListDependencies) {
    this.idGenerator = deps.idGenerator ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: CreateStakeholderListCommand): Promise<StakeholderListDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'constituyente.editar',
      scope: 'GLOBAL',
    });

    const programId = await this.deps.programResolver.getCurrentProgramId();
    if (!programId) {
      throw new StakeholderListProgramNotConfiguredError();
    }

    const list = StakeholderList.create({
      id: this.idGenerator(),
      programId,
      type: command.type,
      year: command.year,
      studyPlanNumber: command.studyPlanNumber,
      version: command.version,
      actorId: command.actorId,
      now: this.clock(),
    });

    return await this.deps.unitOfWork.run(async () => {
      await this.deps.stakeholderListRepository.save(list);

      await this.deps.auditLogger.log({
        action: 'CREATE',
        entity: 'StakeholderList',
        entityId: list.id,
        actor: command.actorId,
        ip: command.ip ?? undefined,
        before: null,
        after: list.snapshot(),
      });

      return buildStakeholderListDto(list, 0, null);
    });
  }
}
