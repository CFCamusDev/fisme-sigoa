import { InvalidProgramDataError } from '../errors/invalid-program-data-error.js';

export interface ProgramProperties {
  readonly id: string;
  code: string;
  name: string;
  faculty: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ProgramValuesSnapshot = {
  readonly code: string;
  readonly name: string;
  readonly faculty: string;
};

export interface ProgramChangesResult {
  readonly before: ProgramValuesSnapshot;
  readonly after: ProgramValuesSnapshot;
  readonly changed: boolean;
}

const PROGRAM_CODE_REGEX = /^[A-Z0-9_-]+$/;
const PROGRAM_CODE_MIN_LENGTH = 2;
const PROGRAM_CODE_MAX_LENGTH = 20;
const PROGRAM_NAME_MIN_LENGTH = 3;
const PROGRAM_NAME_MAX_LENGTH = 150;
const PROGRAM_FACULTY_MIN_LENGTH = 3;
const PROGRAM_FACULTY_MAX_LENGTH = 150;

export class Program {
  private constructor(private readonly props: ProgramProperties) {}

  public static create(rawProps: ProgramProperties): Program {
    const code = Program.validateAndNormalizeCode(rawProps.code);
    const name = Program.validateAndNormalizeName(rawProps.name);
    const faculty = Program.validateAndNormalizeFaculty(rawProps.faculty);

    return new Program({
      ...rawProps,
      code,
      name,
      faculty,
    });
  }

  public get id(): string {
    return this.props.id;
  }

  public get code(): string {
    return this.props.code;
  }

  public get name(): string {
    return this.props.name;
  }

  public get faculty(): string {
    return this.props.faculty;
  }

  public get createdBy(): string | null | undefined {
    return this.props.createdBy;
  }

  public get updatedBy(): string | null | undefined {
    return this.props.updatedBy;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public applyChanges(
    changes: {
      code?: string;
      name?: string;
      faculty?: string;
    },
    actorId?: string,
  ): ProgramChangesResult {
    const before: ProgramValuesSnapshot = {
      code: this.props.code,
      name: this.props.name,
      faculty: this.props.faculty,
    };

    const newCode =
      changes.code !== undefined ? Program.validateAndNormalizeCode(changes.code) : this.props.code;
    const newName =
      changes.name !== undefined ? Program.validateAndNormalizeName(changes.name) : this.props.name;
    const newFaculty =
      changes.faculty !== undefined
        ? Program.validateAndNormalizeFaculty(changes.faculty)
        : this.props.faculty;

    const changed =
      newCode !== before.code || newName !== before.name || newFaculty !== before.faculty;

    if (!changed) {
      return {
        before,
        after: { ...before },
        changed: false,
      };
    }

    this.props.code = newCode;
    this.props.name = newName;
    this.props.faculty = newFaculty;
    if (actorId) {
      this.props.updatedBy = actorId;
    }
    this.props.updatedAt = new Date();

    return {
      before,
      after: {
        code: this.props.code,
        name: this.props.name,
        faculty: this.props.faculty,
      },
      changed: true,
    };
  }

  private static validateAndNormalizeCode(rawCode: string): string {
    const code = rawCode.trim();
    if (
      code.length < PROGRAM_CODE_MIN_LENGTH ||
      code.length > PROGRAM_CODE_MAX_LENGTH ||
      !PROGRAM_CODE_REGEX.test(code)
    ) {
      throw new InvalidProgramDataError(
        `El código del programa debe tener entre ${PROGRAM_CODE_MIN_LENGTH} y ${PROGRAM_CODE_MAX_LENGTH} caracteres alfanuméricos en mayúsculas.`,
      );
    }
    return code;
  }

  private static validateAndNormalizeName(rawName: string): string {
    const name = rawName.trim();
    if (name.length < PROGRAM_NAME_MIN_LENGTH || name.length > PROGRAM_NAME_MAX_LENGTH) {
      throw new InvalidProgramDataError(
        `El nombre del programa debe tener entre ${PROGRAM_NAME_MIN_LENGTH} y ${PROGRAM_NAME_MAX_LENGTH} caracteres.`,
      );
    }
    return name;
  }

  private static validateAndNormalizeFaculty(rawFaculty: string): string {
    const faculty = rawFaculty.trim();
    if (
      faculty.length < PROGRAM_FACULTY_MIN_LENGTH ||
      faculty.length > PROGRAM_FACULTY_MAX_LENGTH
    ) {
      throw new InvalidProgramDataError(
        `El nombre de la facultad debe tener entre ${PROGRAM_FACULTY_MIN_LENGTH} y ${PROGRAM_FACULTY_MAX_LENGTH} caracteres.`,
      );
    }
    return faculty;
  }
}
