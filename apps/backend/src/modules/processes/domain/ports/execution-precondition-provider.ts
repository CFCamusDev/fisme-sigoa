import type { ProcessExecution } from '../entities/process-execution.js';
import type {
  ExecutionPreconditionCode,
  ExecutionPreconditionResult,
} from '../entities/process-execution-precondition.js';

/**
 * Contrato para evaluar precondiciones de transición de una ejecución de proceso.
 * Se invoca dentro de la transacción de avance con la fila de la ejecución bloqueada (`FOR UPDATE`).
 * Las operaciones de otros módulos que alteren datos evaluados aquí (p. ej. firmar acta o cerrar encuesta)
 * deben bloquear la fila de la ejecución antes de modificar su estado para evitar condiciones de carrera (TOCTOU).
 */
export interface ExecutionPreconditionProvider {
  readonly codes: readonly ExecutionPreconditionCode[];
  evaluate(execution: ProcessExecution): Promise<readonly ExecutionPreconditionResult[]>;
}
