import { parametersResponseSchema, type ParametersResponse } from '@sigoa/shared';
import type { Semester } from '../domain/entities/semester.js';
import { ParameterSemesterNotFoundError } from '../domain/errors/index.js';
import { findSemesterAt } from '../domain/policies/find-semester-at.js';
import type { ParameterReader } from '../domain/ports/parameter-reader.js';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import type { SemesterReader } from '../domain/ports/semester-reader.js';
import type { ListEffectiveParametersQuery } from './list-effective-parameters.types.js';
import { buildParametersView } from './parameter-dto.js';

export interface ListEffectiveParametersDependencies {
  readonly parameterReader: ParameterReader;
  readonly semesterReader: SemesterReader;
  readonly permissionChecker: ParametersPermissionChecker;
  readonly clock?: () => Date;
}

/**
 * Lista los parámetros vigentes de un semestre con su historial (HU-011, RF-011, CA1, CA2).
 * Es una lectura: verifica permiso, no abre transacción ni audita (RS-043, D13).
 */
export class ListEffectiveParametersUseCase {
  private readonly clock: () => Date;

  constructor(private readonly deps: ListEffectiveParametersDependencies) {
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(query: ListEffectiveParametersQuery): Promise<ParametersResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: query.actorId,
      permission: 'parametro.ver',
      scope: 'GLOBAL',
    });

    const semesters = await this.deps.semesterReader.list();
    const semester = this.selectSemester(semesters, query.semesterCode);
    const versions = await this.deps.parameterReader.listVersions();

    return parametersResponseSchema.parse(buildParametersView({ versions, semesters, semester }));
  }

  private selectSemester(semesters: readonly Semester[], semesterCode?: string): Semester | null {
    if (semesterCode === undefined) {
      return findSemesterAt(semesters, this.clock().toISOString().slice(0, 10));
    }
    const semester = semesters.find((item) => item.code === semesterCode);
    if (!semester) {
      throw new ParameterSemesterNotFoundError(`El semestre ${semesterCode} no existe.`);
    }
    return semester;
  }
}
