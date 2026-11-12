/**
 * Reglas de idempotencia para los pasos de Seed:
 * 1. Cada paso de semilla DEBE ser estrictamente idempotente.
 * 2. Utilizar siempre operaciones `upsert` basadas en claves naturales únicas (o verificar existencia antes de insertar),
 *    NUNCA realizar `create` ciego sin verificar.
 * 3. Asignar los campos de auditoría `createdBy` y `updatedBy` con el identificador constante 'SEED'.
 * 4. Toda la ejecución de los pasos se realiza dentro de una única transacción ACID.
 */

export interface SeedStep<Db> {
  id: string;
  run(db: Db): Promise<void>;
}

export interface SeedRunnerLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface SeedRunnerOptions<Db> {
  steps: SeedStep<Db>[];
  transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T>;
  logger?: SeedRunnerLogger;
}

export async function runSeed<Db>(options: SeedRunnerOptions<Db>): Promise<void> {
  const { steps, transaction, logger } = options;

  // Validación de IDs duplicados
  const seenIds = new Set<string>();
  for (const step of steps) {
    if (seenIds.has(step.id)) {
      throw new Error(`Duplicate seed step id: "${step.id}"`);
    }
    seenIds.add(step.id);
  }

  if (steps.length === 0) {
    logger?.info('No seed steps defined. Nothing to seed.');
    return;
  }

  logger?.info(`Starting database seed with ${steps.length} steps...`);

  await transaction(async (tx) => {
    for (const step of steps) {
      logger?.info(`[SEED] Executing step "${step.id}"...`);
      try {
        await step.run(tx);
        logger?.info(`[SEED] Completed step "${step.id}"`);
      } catch (error) {
        logger?.error(`[SEED] Failed step "${step.id}"`, error);
        throw error;
      }
    }
  });

  logger?.info('Database seed completed successfully.');
}
