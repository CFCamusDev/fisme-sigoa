import type { Parameter } from '../entities/parameter.js';
import type { ParameterVersion } from './parameter-reader.js';

export interface ParameterRepository {
  /** Exige transacción activa: bloquea la tabla y devuelve todas las versiones. */
  lockAndListVersions(): Promise<ParameterVersion[]>;
  /** Inserta la versión `(clave, semestre)` o reemplaza su valor si ya existe. */
  save(parameter: Parameter): Promise<void>;
}
