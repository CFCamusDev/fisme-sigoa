import type { LoginPolicy } from '../value-objects/login-policy.js';
import {
  AccountLockedError,
  AccountInactiveError,
  AccountPendingActivationError,
} from '../errors/index.js';

export type UserStatus = 'PENDING_ACTIVATION' | 'ACTIVE' | 'INACTIVE';

export interface UserProps {
  id: string;
  names: string;
  firstSurname: string;
  secondSurname?: string | null;
  email: string;
  dni?: string | null;
  passwordHash?: string | null;
  status: UserStatus;
  failedLoginAttempts: number;
  lockedUntil?: Date | null;
  lastLoginAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export class User {
  private _failedLoginAttempts: number;
  private _lockedUntil: Date | null;
  private _lastLoginAt: Date | null;
  private _status: UserStatus;
  private _passwordHash: string | null;
  private _updatedAt?: Date;

  private constructor(private readonly props: UserProps) {
    this.props.email = props.email.trim().toLowerCase();
    this._status = props.status;
    this._failedLoginAttempts = props.failedLoginAttempts;
    this._lockedUntil = props.lockedUntil ? new Date(props.lockedUntil.getTime()) : null;
    this._lastLoginAt = props.lastLoginAt ? new Date(props.lastLoginAt.getTime()) : null;
    this._passwordHash = props.passwordHash ?? null;
    this._updatedAt = props.updatedAt;
  }

  public static restore(props: UserProps): User {
    return new User({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get names(): string {
    return this.props.names;
  }

  get firstSurname(): string {
    return this.props.firstSurname;
  }

  get secondSurname(): string | null | undefined {
    return this.props.secondSurname;
  }

  get email(): string {
    return this.props.email;
  }

  get dni(): string | null | undefined {
    return this.props.dni;
  }

  get passwordHash(): string | null {
    return this._passwordHash;
  }

  get status(): UserStatus {
    return this._status;
  }

  get failedLoginAttempts(): number {
    return this._failedLoginAttempts;
  }

  get lockedUntil(): Date | null {
    return this._lockedUntil ? new Date(this._lockedUntil.getTime()) : null;
  }

  get lastLoginAt(): Date | null {
    return this._lastLoginAt ? new Date(this._lastLoginAt.getTime()) : null;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this._updatedAt;
  }

  get createdBy(): string | null | undefined {
    return this.props.createdBy;
  }

  get updatedBy(): string | null | undefined {
    return this.props.updatedBy;
  }

  /**
   * Determina si la cuenta está actualmente bloqueada en el instante `now`.
   */
  public isLocked(now: Date): boolean {
    return Boolean(this._lockedUntil && this._lockedUntil.getTime() > now.getTime());
  }

  /**
   * Calcula los segundos restantes de bloqueo redondeados hacia arriba.
   */
  public lockRemainingSeconds(now: Date): number {
    if (!this.isLocked(now) || !this._lockedUntil) {
      return 0;
    }
    const diffMs = this._lockedUntil.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / 1000));
  }

  /**
   * Valida si el usuario puede intentar autenticarse en el instante `now`.
   * Lanza AccountLockedError, AccountPendingActivationError o AccountInactiveError según corresponda.
   */
  public assertCanAuthenticate(now: Date): void {
    if (this.isLocked(now)) {
      throw new AccountLockedError(this.lockRemainingSeconds(now));
    }

    if (this._status === 'PENDING_ACTIVATION') {
      throw new AccountPendingActivationError();
    }

    if (this._status === 'INACTIVE') {
      throw new AccountInactiveError();
    }
  }

  /**
   * Registra un intento fallido de inicio de sesión aplicando la política configurada.
   * Si el bloqueo anterior ya expiró, el contador se reinicia a 1.
   * Si la cuenta ya está actualmente bloqueada, el bloqueo no se extiende.
   */
  public registerFailedLogin(now: Date, policy: LoginPolicy): void {
    if (this.isLocked(now)) {
      // Si la cuenta ya está bloqueada, no se extiende la duración ni se incrementa
      return;
    }

    if (this._lockedUntil && this._lockedUntil.getTime() <= now.getTime()) {
      // El bloqueo previo ya venció: el siguiente fallo reinicia el contador a 1
      this._failedLoginAttempts = 1;
      this._lockedUntil = null;
    } else {
      this._failedLoginAttempts += 1;
    }

    if (this._failedLoginAttempts >= policy.maxFailedAttempts) {
      this._lockedUntil = new Date(now.getTime() + policy.lockoutMinutes * 60 * 1000);
    }
  }

  /**
   * Registra un inicio de sesión exitoso, restableciendo el contador y bloqueo temporal.
   */
  public registerSuccessfulLogin(now: Date): void {
    this._failedLoginAttempts = 0;
    this._lockedUntil = null;
    this._lastLoginAt = new Date(now.getTime());
  }
}
