export interface NewAdministratorData {
  readonly email: string;
  readonly names: string;
  readonly firstSurname: string;
  readonly secondSurname: string | null;
  readonly dni: string;
  readonly passwordHash: string;
}

/** Acceso a datos del alta del primer administrador; corre dentro de la transacción del seed. */
export interface BootstrapAdminRepository {
  /** ¿Existe algún usuario con rol ADMINISTRATOR, en cualquier estado? */
  existsAdministrator(): Promise<boolean>;
  /** Indica qué dato (correo o DNI) ya está usado por algún usuario, o null si ninguno. */
  findUserByEmailOrDni(email: string, dni: string): Promise<'EMAIL' | 'DNI' | null>;
  /** Crea el usuario ACTIVE con rol ADMINISTRATOR (createdBy SEED) y devuelve su id. */
  createAdministrator(data: NewAdministratorData): Promise<string>;
}
