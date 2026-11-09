import type { ProgramDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { ProgramNotFoundError } from '../domain/errors/program-not-found-error.js';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import type { ProgramRepository } from '../domain/ports/program-repository.js';
import type { EditProgramCommand } from './edit-program.types.js';
import { mapProgramToDto } from './program-dto.js';

export interface EditProgramUseCaseDependencies {
  readonly programRepository: ProgramRepository;
  readonly permissionChecker: ParametersPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
}

export class EditProgramUseCase {
  constructor(private readonly deps: EditProgramUseCaseDependencies) {}

  async execute(cmd: EditProgramCommand): Promise<ProgramDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: cmd.actorId,
      permission: 'parametro.editar',
      scope: 'GLOBAL',
    });

    return await this.deps.unitOfWork.run(async () => {
      const program = await this.deps.programRepository.findCurrentForUpdate();
      if (!program) {
        throw new ProgramNotFoundError('No existe un programa configurado.');
      }

      const result = program.applyChanges(
        {
          code: cmd.code,
          name: cmd.name,
          faculty: cmd.faculty,
        },
        cmd.actorId,
      );

      if (!result.changed) {
        return mapProgramToDto(program);
      }

      await this.deps.programRepository.save(program);

      await this.deps.auditLogger.log({
        action: 'PARAMETER_CHANGE',
        entity: 'Program',
        entityId: program.id,
        actor: cmd.actorId,
        ip: cmd.ip,
        before: result.before,
        after: result.after,
      });

      return mapProgramToDto(program);
    });
  }
}
