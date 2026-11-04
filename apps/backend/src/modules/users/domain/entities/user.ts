import {
  DNI_PATTERN,
  USER_EMAIL_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  type UserStatus,
} from '@sigoa/shared';
import { InvalidUserDataError, InvalidUserStatusTransitionError } from '../errors/index.js';

export interface UserAuditSnapshot {
  id: string;
  names: string;
  firstSurname: string;
  secondSurname: string | null;
  email: string;
  dni: string | null;
  status: UserStatus;
}

export interface UserCreateProps {
  id: string;
  names: string;
  firstSurname: string;
  secondSurname?: string | null;
  email: string;
  dni: string;
  createdBy?: string | null;
}

export interface UserRestoreProps {
  id: string;
  names: string;
  firstSurname: string;
  secondSurname: string | null;
  email: string;
  dni: string | null;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserChangeProps {
  names?: string;
  firstSurname?: string;
  secondSurname?: string | null;
  email?: string;
  dni?: string;
}

export interface StatusChangeResult {
  before: UserAuditSnapshot;
  after: UserAuditSnapshot;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function validateAndNormalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized.length > USER_EMAIL_MAX_LENGTH || !EMAIL_REGEX.test(normalized)) {
    throw new InvalidUserDataError('El correo electrónico es inválido o excede la longitud máxima');
  }
  return normalized;
}

function validateAndNormalizeNames(names: string): string {
  const normalized = normalizeName(names);
  if (!normalized || normalized.length > USER_NAME_MAX_LENGTH) {
    throw new InvalidUserDataError(
      'Los nombres son obligatorios y no pueden exceder la longitud máxima',
    );
  }
  return normalized;
}

function validateAndNormalizeFirstSurname(firstSurname: string): string {
  const normalized = normalizeName(firstSurname);
  if (!normalized || normalized.length > USER_NAME_MAX_LENGTH) {
    throw new InvalidUserDataError(
      'El primer apellido es obligatorio y no puede exceder la longitud máxima',
    );
  }
  return normalized;
}

function validateAndNormalizeSecondSurname(secondSurname?: string | null): string | null {
  if (secondSurname === undefined || secondSurname === null) {
    return null;
  }
  const normalized = normalizeName(secondSurname);
  if (!normalized) {
    return null;
  }
  if (normalized.length > USER_NAME_MAX_LENGTH) {
    throw new InvalidUserDataError('El segundo apellido no puede exceder la longitud máxima');
  }
  return normalized;
}

function validateAndNormalizeDni(dni: string): string {
  const trimmed = dni.trim();
  if (!DNI_PATTERN.test(trimmed)) {
    throw new InvalidUserDataError('El DNI debe contener exactamente 8 dígitos numéricos');
  }
  return trimmed;
}

export class User {
  private _id: string;
  private _names: string;
  private _firstSurname: string;
  private _secondSurname: string | null;
  private _email: string;
  private _dni: string | null;
  private _status: UserStatus;
  private _lastLoginAt: Date | null;
  private _createdBy: string | null;
  private _updatedBy: string | null;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: UserRestoreProps) {
    this._id = props.id;
    this._names = props.names;
    this._firstSurname = props.firstSurname;
    this._secondSurname = props.secondSurname;
    this._email = props.email;
    this._dni = props.dni;
    this._status = props.status;
    this._lastLoginAt = props.lastLoginAt;
    this._createdBy = props.createdBy;
    this._updatedBy = props.updatedBy;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  public static create(props: UserCreateProps): User {
    if (!props.id || !props.id.trim()) {
      throw new InvalidUserDataError('El identificador de usuario es obligatorio');
    }

    const names = validateAndNormalizeNames(props.names);
    const firstSurname = validateAndNormalizeFirstSurname(props.firstSurname);
    const secondSurname = validateAndNormalizeSecondSurname(props.secondSurname);
    const email = validateAndNormalizeEmail(props.email);
    const dni = validateAndNormalizeDni(props.dni);

    const now = new Date();
    return new User({
      id: props.id.trim(),
      names,
      firstSurname,
      secondSurname,
      email,
      dni,
      status: 'PENDING_ACTIVATION',
      lastLoginAt: null,
      createdBy: props.createdBy ?? null,
      updatedBy: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static restore(props: UserRestoreProps): User {
    return new User(props);
  }

  public get id(): string {
    return this._id;
  }

  public get names(): string {
    return this._names;
  }

  public get firstSurname(): string {
    return this._firstSurname;
  }

  public get secondSurname(): string | null {
    return this._secondSurname;
  }

  public get email(): string {
    return this._email;
  }

  public get dni(): string | null {
    return this._dni;
  }

  public get status(): UserStatus {
    return this._status;
  }

  public get lastLoginAt(): Date | null {
    return this._lastLoginAt;
  }

  public get createdBy(): string | null {
    return this._createdBy;
  }

  public get updatedBy(): string | null {
    return this._updatedBy;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public applyChanges(changes: UserChangeProps, updatedBy: string): StatusChangeResult {
    // Validar antes de mutar para asegurar atomicidad e inmutabilidad ante errores
    const newNames =
      changes.names !== undefined ? validateAndNormalizeNames(changes.names) : this._names;
    const newFirstSurname =
      changes.firstSurname !== undefined
        ? validateAndNormalizeFirstSurname(changes.firstSurname)
        : this._firstSurname;
    const newSecondSurname =
      changes.secondSurname !== undefined
        ? validateAndNormalizeSecondSurname(changes.secondSurname)
        : this._secondSurname;
    const newEmail =
      changes.email !== undefined ? validateAndNormalizeEmail(changes.email) : this._email;
    const newDni = changes.dni !== undefined ? validateAndNormalizeDni(changes.dni) : this._dni;

    const before = this.toAuditSnapshot();

    this._names = newNames;
    this._firstSurname = newFirstSurname;
    this._secondSurname = newSecondSurname;
    this._email = newEmail;
    this._dni = newDni;
    this._updatedBy = updatedBy;
    this._updatedAt = new Date();

    const after = this.toAuditSnapshot();
    return { before, after };
  }

  public deactivate(updatedBy: string): StatusChangeResult {
    if (this._status !== 'ACTIVE') {
      throw new InvalidUserStatusTransitionError(
        'Solo se puede inactivar a un usuario que se encuentre en estado Activo',
      );
    }

    const before = this.toAuditSnapshot();
    this._status = 'INACTIVE';
    this._updatedBy = updatedBy;
    this._updatedAt = new Date();
    const after = this.toAuditSnapshot();

    return { before, after };
  }

  public reactivate(updatedBy: string): StatusChangeResult {
    if (this._status !== 'INACTIVE') {
      throw new InvalidUserStatusTransitionError(
        'Solo se puede reactivar a un usuario que se encuentre en estado Inactivo',
      );
    }

    const before = this.toAuditSnapshot();
    this._status = 'ACTIVE';
    this._updatedBy = updatedBy;
    this._updatedAt = new Date();
    const after = this.toAuditSnapshot();

    return { before, after };
  }

  public toAuditSnapshot(): UserAuditSnapshot {
    return {
      id: this._id,
      names: this._names,
      firstSurname: this._firstSurname,
      secondSurname: this._secondSurname,
      email: this._email,
      dni: this._dni ? `******${this._dni.slice(-2)}` : null,
      status: this._status,
    };
  }
}
