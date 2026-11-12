import {
  ROLE_DESCRIPTION_MAX_LENGTH,
  ROLE_ID_MAX_LENGTH,
  ROLE_NAME_MAX_LENGTH,
  ROLE_NAME_MIN_LENGTH,
  type RoleStatus,
} from '@sigoa/shared';
import { InvalidRoleDataError } from '../errors/invalid-role-data-error.js';
import { InvalidRoleStatusTransitionError } from '../errors/invalid-role-status-transition-error.js';
import { deriveRoleCode } from '../policies/derive-role-code.js';

export interface RoleAuditSnapshot {
  readonly [key: string]: unknown;
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: RoleStatus;
  readonly isPredefined: boolean;
}

export interface RoleCreateProps {
  readonly id: string;
  readonly name: string;
  readonly description?: string | null;
  readonly createdBy?: string | null;
}

export interface RoleRestoreProps {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: RoleStatus;
  readonly deactivatedAt: Date | null;
  readonly isPredefined: boolean;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface RoleApplyChangesInput {
  readonly name?: string;
  readonly description?: string | null;
}

export interface RoleApplyChangesResult {
  readonly before: RoleAuditSnapshot;
  readonly after: RoleAuditSnapshot;
  readonly hasChanges: boolean;
}

export interface RoleStateChangeResult {
  readonly before: RoleAuditSnapshot;
  readonly after: RoleAuditSnapshot;
}

export function normalizeRoleName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new InvalidRoleDataError('El nombre del rol es requerido', [
      { path: 'name', message: 'El nombre es obligatorio' },
    ]);
  }

  const normalizedName = name.trim().replace(/\s+/g, ' ');
  if (
    normalizedName.length < ROLE_NAME_MIN_LENGTH ||
    normalizedName.length > ROLE_NAME_MAX_LENGTH
  ) {
    throw new InvalidRoleDataError(
      `El nombre del rol debe tener entre ${ROLE_NAME_MIN_LENGTH} y ${ROLE_NAME_MAX_LENGTH} caracteres`,
      [
        {
          path: 'name',
          message: `El nombre debe tener entre ${ROLE_NAME_MIN_LENGTH} y ${ROLE_NAME_MAX_LENGTH} caracteres`,
        },
      ],
    );
  }

  return normalizedName;
}

export function normalizeRoleDescription(description: string | null | undefined): string | null {
  if (description === undefined || description === null) {
    return null;
  }
  const trimmed = description.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > ROLE_DESCRIPTION_MAX_LENGTH) {
    throw new InvalidRoleDataError(
      `La descripción no puede exceder ${ROLE_DESCRIPTION_MAX_LENGTH} caracteres`,
      [
        {
          path: 'description',
          message: `La descripción no puede exceder ${ROLE_DESCRIPTION_MAX_LENGTH} caracteres`,
        },
      ],
    );
  }
  return trimmed;
}

export class Role {
  private readonly _id: string;
  private readonly _code: string;
  private _name: string;
  private _description: string | null;
  private _status: RoleStatus;
  private _deactivatedAt: Date | null;
  private readonly _isPredefined: boolean;
  private readonly _createdBy: string | null;
  private _updatedBy: string | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: RoleRestoreProps) {
    this._id = props.id;
    this._code = props.code;
    this._name = props.name;
    this._description = props.description;
    this._status = props.status;
    this._deactivatedAt = props.deactivatedAt;
    this._isPredefined = props.isPredefined;
    this._createdBy = props.createdBy;
    this._updatedBy = props.updatedBy;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  public static create(props: RoleCreateProps): Role {
    if (!props.id || typeof props.id !== 'string' || props.id.trim().length === 0) {
      throw new InvalidRoleDataError('El identificador del rol es requerido', [
        { path: 'id', message: 'El identificador del rol no puede estar vacío' },
      ]);
    }
    if (props.id.length > ROLE_ID_MAX_LENGTH) {
      throw new InvalidRoleDataError('El identificador del rol excede la longitud máxima', [
        {
          path: 'id',
          message: `El identificador no puede exceder ${ROLE_ID_MAX_LENGTH} caracteres`,
        },
      ]);
    }

    const normalizedName = normalizeRoleName(props.name);
    const normalizedDescription = normalizeRoleDescription(props.description);

    const code = deriveRoleCode(normalizedName);
    const now = new Date();

    return new Role({
      id: props.id.trim(),
      code,
      name: normalizedName,
      description: normalizedDescription,
      status: 'ACTIVE',
      deactivatedAt: null,
      isPredefined: false,
      createdBy: props.createdBy ?? null,
      updatedBy: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static restore(props: RoleRestoreProps): Role {
    return new Role(props);
  }

  public get id(): string {
    return this._id;
  }

  public get code(): string {
    return this._code;
  }

  public get name(): string {
    return this._name;
  }

  public get description(): string | null {
    return this._description;
  }

  public get status(): RoleStatus {
    return this._status;
  }

  public get deactivatedAt(): Date | null {
    return this._deactivatedAt;
  }

  public get isPredefined(): boolean {
    return this._isPredefined;
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

  public applyChanges(
    changes: RoleApplyChangesInput,
    updatedBy: string | null,
    now?: Date,
  ): RoleApplyChangesResult {
    const before = this.toAuditSnapshot();
    let hasChanges = false;

    if (changes.name !== undefined) {
      const normalizedName = normalizeRoleName(changes.name);
      if (normalizedName !== this._name) {
        this._name = normalizedName;
        hasChanges = true;
      }
    }

    if (changes.description !== undefined) {
      const normalizedDescription = normalizeRoleDescription(changes.description);
      if (normalizedDescription !== this._description) {
        this._description = normalizedDescription;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this._updatedBy = updatedBy;
      this._updatedAt = now ?? new Date();
    }

    const after = this.toAuditSnapshot();
    return { before, after, hasChanges };
  }

  public deactivate(updatedBy: string | null, now?: Date): RoleStateChangeResult {
    if (this._status === 'INACTIVE') {
      throw new InvalidRoleStatusTransitionError('El rol ya se encuentra inactivo');
    }

    const before = this.toAuditSnapshot();
    const timestamp = now ?? new Date();

    this._status = 'INACTIVE';
    this._deactivatedAt = timestamp;
    this._updatedBy = updatedBy;
    this._updatedAt = timestamp;

    const after = this.toAuditSnapshot();
    return { before, after };
  }

  public reactivate(updatedBy: string | null, now?: Date): RoleStateChangeResult {
    if (this._status === 'ACTIVE') {
      throw new InvalidRoleStatusTransitionError('El rol ya se encuentra activo');
    }

    const before = this.toAuditSnapshot();
    const timestamp = now ?? new Date();

    this._status = 'ACTIVE';
    this._deactivatedAt = null;
    this._updatedBy = updatedBy;
    this._updatedAt = timestamp;

    const after = this.toAuditSnapshot();
    return { before, after };
  }

  public toAuditSnapshot(): RoleAuditSnapshot {
    return {
      id: this._id,
      code: this._code,
      name: this._name,
      description: this._description,
      status: this._status,
      isPredefined: this._isPredefined,
    };
  }
}
