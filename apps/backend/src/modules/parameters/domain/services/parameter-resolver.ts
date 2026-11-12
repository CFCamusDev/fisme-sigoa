import type { Semester } from '../entities/semester.js';
import { ParameterNotConfiguredError, ParameterSemesterNotFoundError } from '../errors/index.js';
import { PARAMETER_KEYS, type ParameterKey } from '../policies/parameter-catalog.js';
import { findSemesterAt } from '../policies/find-semester-at.js';
import { pickEffectiveVersion } from '../policies/pick-effective-version.js';
import type { ParameterReader, ParameterVersion } from '../ports/parameter-reader.js';
import type { SemesterReader } from '../ports/semester-reader.js';

export type ResolvedParameters = Record<ParameterKey, number>;

export interface ParameterResolverDependencies {
  readonly parameterReader: ParameterReader;
  readonly semesterReader: SemesterReader;
}

/** Resuelve el valor vigente de los parámetros para un semestre (RN-005, RS-005). */
export class ParameterResolver {
  constructor(private readonly deps: ParameterResolverDependencies) {}

  public async resolve(key: ParameterKey, semesterCode: string): Promise<number> {
    const semester = await this.findSemester(semesterCode);
    const versions = await this.deps.parameterReader.listVersions();
    return this.pick(versions, key, semester.startDate);
  }

  public async resolveAll(semesterCode: string): Promise<ResolvedParameters> {
    const semester = await this.findSemester(semesterCode);
    const versions = await this.deps.parameterReader.listVersions();
    return this.pickAll(versions, semester.startDate);
  }

  /** Valores vigentes en un día: los del último semestre iniciado hasta esa fecha. */
  public async resolveAt(isoDay: string): Promise<ResolvedParameters> {
    const semesters = await this.deps.semesterReader.list();
    const latestStart = findSemesterAt(semesters, isoDay)?.startDate ?? null;
    const versions = await this.deps.parameterReader.listVersions();
    return this.pickAll(versions, latestStart);
  }

  private async findSemester(semesterCode: string): Promise<Semester> {
    const semesters = await this.deps.semesterReader.list();
    const semester = semesters.find((item) => item.code === semesterCode);
    if (!semester) {
      throw new ParameterSemesterNotFoundError(`El semestre ${semesterCode} no existe.`);
    }
    return semester;
  }

  private pickAll(
    versions: readonly ParameterVersion[],
    semesterStartDate: string | null,
  ): ResolvedParameters {
    const resolved = {} as ResolvedParameters;
    for (const key of PARAMETER_KEYS) {
      resolved[key] = this.pick(versions, key, semesterStartDate);
    }
    return resolved;
  }

  private pick(
    versions: readonly ParameterVersion[],
    key: ParameterKey,
    semesterStartDate: string | null,
  ): number {
    const ofKey = versions.filter((version) => version.parameter.key === key);
    const selected = pickEffectiveVersion(ofKey, semesterStartDate);
    if (!selected) {
      throw new ParameterNotConfiguredError(key);
    }
    return selected.parameter.value;
  }
}
