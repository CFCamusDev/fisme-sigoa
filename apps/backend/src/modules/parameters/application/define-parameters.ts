import { randomUUID } from 'node:crypto';
import { parametersResponseSchema, type ParametersResponse } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { Parameter } from '../domain/entities/parameter.js';
import { ParameterSemesterNotFoundError } from '../domain/errors/index.js';
import { assertValidParameterChange } from '../domain/policies/parameter-values-policy.js';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import type { ParameterVersion } from '../domain/ports/parameter-reader.js';
import type { ParameterRepository } from '../domain/ports/parameter-repository.js';
import type { SemesterReader } from '../domain/ports/semester-reader.js';
import type { DefineParametersCommand } from './define-parameters.types.js';
import { buildParametersView } from './parameter-dto.js';

export interface DefineParametersDependencies {
  readonly parameterRepository: ParameterRepository;
  readonly semesterReader: SemesterReader;
  readonly permissionChecker: ParametersPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly idGenerator?: () => string;
  readonly clock?: () => Date;
}

/**
 * Define parámetros con vigencia desde un semestre (HU-011, RF-011, RS-020, RS-043).
 * Cada clave crea una versión nueva o reemplaza el valor de la versión (clave, semestre) (D5).
 */
export class DefineParametersUseCase {
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(private readonly deps: DefineParametersDependencies) {
    this.idGenerator = deps.idGenerator ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: DefineParametersCommand): Promise<ParametersResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'parametro.editar',
      scope: 'GLOBAL',
    });

    return await this.deps.unitOfWork.run(async () => {
      const versions = await this.deps.parameterRepository.lockAndListVersions();

      const semesters = await this.deps.semesterReader.list();
      const semester = semesters.find((item) => item.code === command.semesterCode);
      if (!semester) {
        throw new ParameterSemesterNotFoundError(`El semestre ${command.semesterCode} no existe.`);
      }

      assertValidParameterChange(command.values);

      const now = this.clock();
      let current: ParameterVersion[] = [...versions];

      for (const item of command.values) {
        const existing = current.find(
          (version) =>
            version.parameter.key === item.key &&
            version.parameter.effectiveFromSemesterId === semester.id,
        );
        if (existing && existing.parameter.value === item.value) {
          continue;
        }

        const parameter = Parameter.create({
          id: existing?.parameter.id ?? this.idGenerator(),
          key: item.key,
          value: item.value,
          effectiveFromSemesterId: semester.id,
          createdBy: existing?.parameter.createdBy ?? command.actorId,
          updatedBy: command.actorId,
          createdAt: existing?.parameter.createdAt ?? now,
          updatedAt: now,
        });

        await this.deps.parameterRepository.save(parameter);

        await this.deps.auditLogger.log({
          action: 'PARAMETER_CHANGE',
          entity: 'Parameter',
          entityId: parameter.id,
          actor: command.actorId,
          ip: command.ip,
          before: existing ? { key: item.key, value: existing.parameter.value } : null,
          after: { key: item.key, value: item.value, effectiveFrom: semester.code },
        });

        const saved: ParameterVersion = {
          parameter,
          semesterCode: semester.code,
          semesterStartDate: semester.startDate,
        };
        current = existing
          ? current.map((version) => (version === existing ? saved : version))
          : [...current, saved];
      }

      return parametersResponseSchema.parse(
        buildParametersView({ versions: current, semesters, semester }),
      );
    });
  }
}
