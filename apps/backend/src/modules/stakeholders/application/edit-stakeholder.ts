import type { StakeholderDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import {
  InvalidStakeholderTransitionError,
  StakeholderNotFoundError,
} from '../domain/errors/index.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import type { StakeholderRepository } from '../domain/ports/stakeholder-repository.js';
import type { EditStakeholderCommand } from './edit-stakeholder.types.js';
import { buildStakeholderDto } from './stakeholder-dto.js';

export interface EditStakeholderDependencies {
  readonly stakeholderRepository: StakeholderRepository;
  readonly permissionChecker: StakeholderPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly clock?: () => Date;
}

/**
 * Edita los datos de un constituyente activo con persistencia condicional y auditoría
 * en la misma transacción (HU-021, RF-021, RS-020).
 */
export class EditStakeholderUseCase {
  private readonly clock: () => Date;

  constructor(private readonly deps: EditStakeholderDependencies) {
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: EditStakeholderCommand): Promise<StakeholderDto> {
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
      const updated = existing.edit({
        fullName: command.fullName,
        dni: command.dni,
        ruc: command.ruc,
        email: command.email,
        mobile: command.mobile,
        position: command.position,
        institution: command.institution,
        sector: command.sector,
        graduationYear: command.graduationYear,
        cycle: command.cycle,
        now: this.clock(),
      });

      const saved = await this.deps.stakeholderRepository.saveChanges(updated, 'ACTIVE');
      if (!saved) {
        throw new InvalidStakeholderTransitionError(
          'El constituyente fue anulado y no puede editarse.',
        );
      }

      await this.deps.auditLogger.log({
        action: 'UPDATE',
        entity: 'Stakeholder',
        entityId: updated.id,
        actor: command.actorId,
        ip: command.ip ?? undefined,
        before,
        after: updated.snapshot(),
      });

      return buildStakeholderDto(updated);
    });
  }
}
