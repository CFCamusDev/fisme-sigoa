import { randomUUID } from 'node:crypto';
import { semesterDtoSchema, type SemesterDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { Semester } from '../domain/entities/semester.js';
import { assertSemesterFitsSchedule } from '../domain/policies/semester-schedule.js';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import type { SemesterRepository } from '../domain/ports/semester-repository.js';
import type { CreateSemesterCommand } from './create-semester.types.js';
import { mapSemesterToDto } from './semester-dto.js';

export interface CreateSemesterDependencies {
  readonly semesterRepository: SemesterRepository;
  readonly permissionChecker: ParametersPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly idGenerator?: () => string;
  readonly clock?: () => Date;
}

export class CreateSemesterUseCase {
  private readonly semesterRepository: SemesterRepository;
  private readonly permissionChecker: ParametersPermissionChecker;
  private readonly unitOfWork: UnitOfWork;
  private readonly auditLogger: AuditLogger;
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(deps: CreateSemesterDependencies) {
    this.semesterRepository = deps.semesterRepository;
    this.permissionChecker = deps.permissionChecker;
    this.unitOfWork = deps.unitOfWork;
    this.auditLogger = deps.auditLogger;
    this.idGenerator = deps.idGenerator ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: CreateSemesterCommand): Promise<SemesterDto> {
    await this.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'parametro.editar',
      scope: 'GLOBAL',
    });

    return await this.unitOfWork.run(async () => {
      const existing = await this.semesterRepository.lockAndListAll();

      const now = this.clock();
      const semester = Semester.create({
        id: this.idGenerator(),
        code: command.code,
        startDate: command.startDate,
        endDate: command.endDate,
        createdBy: command.actorId,
        updatedBy: null,
        createdAt: now,
        updatedAt: now,
      });

      assertSemesterFitsSchedule(semester, existing);

      await this.semesterRepository.add(semester);

      await this.auditLogger.log({
        action: 'CREATE',
        entity: 'Semester',
        entityId: semester.id,
        actor: command.actorId,
        ip: command.ip,
        after: {
          code: semester.code,
          startDate: semester.startDate,
          endDate: semester.endDate,
        },
      });

      const dto = mapSemesterToDto(semester);
      return semesterDtoSchema.parse(dto);
    });
  }
}
