import type { StakeholderDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import {
  InvalidStakeholderTransitionError,
  StakeholderNotFoundError,
} from '../domain/errors/index.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import type { StakeholderRepository } from '../domain/ports/stakeholder-repository.js';
import { buildStakeholderDto } from './stakeholder-dto.js';
import type { VoidStakeholderCommand } from './void-stakeholder.types.js';

export interface VoidStakeholderDependencies {
  readonly stakeholderRepository: StakeholderRepository;
  readonly permissionChecker: StakeholderPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly clock?: () => Date;
}

/**
 * Anula lógicamente un constituyente activo con motivo obligatorio y auditoría VOID
 * en la misma transacción (HU-021, RF-021, RS-020, CA3). Nunca borra físicamente.
 */
export class VoidStakeholderUseCase {
  private readonly clock: () => Date;

  constructor(private readonly deps: VoidStakeholderDependencies) {
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: VoidStakeholderCommand): Promise<StakeholderDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'constituyente.editar',
      scope: 'GLOBAL',
    });

    return await this.deps.unitOfWork.run(async () => {
      const existing = await this.deps.stakeholderRepository.findById(command.id);
      if (!existing) {
        throw new StakeholderNotFoundError();
      }

      const before = existing.snapshot();
      const voided = existing.void({
        reason: command.reason,
        actorId: command.actorId,
        now: this.clock(),
      });

      const saved = await this.deps.stakeholderRepository.saveChanges(voided, 'ACTIVE');
      if (!saved) {
        throw new InvalidStakeholderTransitionError('El constituyente ya fue anulado.');
      }

      await this.deps.auditLogger.log({
        action: 'VOID',
        entity: 'Stakeholder',
        entityId: voided.id,
        actor: command.actorId,
        ip: command.ip ?? undefined,
        before,
        after: voided.snapshot(),
      });

      return buildStakeholderDto(voided);
    });
  }
}
