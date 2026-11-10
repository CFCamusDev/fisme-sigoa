import type { Parameter } from '../entities/parameter.js';

/** Una versión de un parámetro con los datos del semestre desde el que rige (nulos = por defecto). */
export interface ParameterVersion {
  readonly parameter: Parameter;
  readonly semesterCode: string | null;
  readonly semesterStartDate: string | null;
}

export interface ParameterReader {
  /** Todas las versiones, sin bloqueo, ordenadas por clave y vigencia ascendente. */
  listVersions(): Promise<ParameterVersion[]>;
}
