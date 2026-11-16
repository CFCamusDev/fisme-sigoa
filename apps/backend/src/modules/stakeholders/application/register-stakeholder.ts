import { randomUUID } from 'node:crypto';
import type { StakeholderDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { Stakeholder } from '../domain/entities/stakeholder.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import type { StakeholderRepository } from '../domain/ports/stakeholder-repository.js';
import type { RegisterStakeholderCommand } from './register-stakeholder.types.js';
import { buildStakeholderDto } from './stakeholder-dto.js';

export interface RegisterStakeholderDependencies {
  readonly stakeholderRepository: StakeholderRepository;
  readonly permissionChecker: StakeholderPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly idGenerator?: () => string;
  readonly clock?: () => Date;
}

/**
 * Registra un constituyente (persona o institución) en el registro maestro único (HU-021, RF-021,
 * RS-037, RS-020). La unicidad por DNI/RUC la garantiza la restricción única de la base de datos.
 */
export class RegisterStakeholderUseCase {
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(private readonly deps: RegisterStakeholderDependencies) {
    this.idGenerator = deps.idGenerator ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: RegisterStakeholderCommand): Promise<StakeholderDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'constituyente.editar',
      scope: 'GLOBAL',
    });

    const stakeholder = Stakeholder.register({
      id: this.idGenerator(),
      kind: command.kind,
      fullName: command.fullName,
      dni: command.kind === 'PERSON' ? command.dni : null,
      ruc: command.kind === 'INSTITUTION' ? command.ruc : null,
      email: command.email,
      mobile: command.mobile,
      position: command.position,
      institution: command.kind === 'PERSON' ? command.institution : null,
      sector: command.sector,
      graduationYear: command.kind === 'PERSON' ? command.graduationYear : null,
      cycle: command.kind === 'PERSON' ? command.cycle : null,
      actorId: command.actorId,
      now: this.clock(),
    });

    return await this.deps.unitOfWork.run(async () => {
      await this.deps.stakeholderRepository.save(stakeholder);

      await this.deps.auditLogger.log({
        action: 'CREATE',
        entity: 'Stakeholder',
        entityId: stakeholder.id,
        actor: command.actorId,
        ip: command.ip ?? undefined,
        before: null,
        after: stakeholder.snapshot(),
      });

      return buildStakeholderDto(stakeholder);
    });
  }
}
