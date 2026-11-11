import { BootstrapAdminConfigError, BootstrapAdminConflictError } from '../domain/errors/index.js';
import type { BootstrapAdminRepository, InitialPasswordHasher } from '../domain/ports/index.js';

export interface BootstrapAdminInput {
  readonly email: string;
  readonly names: string;
  readonly firstSurname: string;
  readonly secondSurname: string | null;
  readonly dni: string;
  readonly password: string;
}

export type BootstrapAdminInputResult =
  | { readonly ok: true; readonly value: BootstrapAdminInput }
  | { readonly ok: false; readonly issues: readonly { variable: string; message: string }[] };

export interface BootstrapAdminDependencies {
  readonly repository: BootstrapAdminRepository;
  readonly hasher: InitialPasswordHasher;
  /** Lee y valida las variables ADMIN_*; solo se invoca si no existe administrador. */
  readonly loadInput: () => BootstrapAdminInputResult;
  readonly logger?: { info: (message: string, ...args: unknown[]) => void };
}

export type BootstrapAdminOutcome = 'CREATED' | 'SKIPPED';

/**
 * Crea el primer administrador del sistema (RNF-039, RS-015). Se ejecuta dentro de la
 * transacción del seed: si ya existe un administrador no lee variables ni toca nada.
 */
export class BootstrapAdminUseCase {
  constructor(private readonly deps: BootstrapAdminDependencies) {}

  async execute(): Promise<BootstrapAdminOutcome> {
    const { repository, hasher, loadInput, logger } = this.deps;

    if (await repository.existsAdministrator()) {
      logger?.info('[SEED] Administrator already exists. Skipping first administrator creation.');
      return 'SKIPPED';
    }

    const input = loadInput();
    if (!input.ok) {
      throw new BootstrapAdminConfigError(input.issues);
    }

    const conflict = await repository.findUserByEmailOrDni(input.value.email, input.value.dni);
    if (conflict) {
      throw new BootstrapAdminConflictError(conflict === 'EMAIL' ? 'ADMIN_EMAIL' : 'ADMIN_DNI');
    }

    const passwordHash = await hasher.hash(input.value.password);
    const userId = await repository.createAdministrator({
      email: input.value.email,
      names: input.value.names,
      firstSurname: input.value.firstSurname,
      secondSurname: input.value.secondSurname,
      dni: input.value.dni,
      passwordHash,
    });

    logger?.info(`[SEED] First administrator created (id ${userId}).`);
    return 'CREATED';
  }
}
