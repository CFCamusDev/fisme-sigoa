import { InvalidResponseScaleDataError } from '../errors/invalid-response-scale-data-error.js';

export const SCALE_TYPES = ['LIKERT', 'NUMERIC', 'EVIDENCE'] as const;
export type ScaleType = (typeof SCALE_TYPES)[number];

export const RESPONSE_SCALE_LIMITS = {
  codeRegex: /^[A-Z][A-Z0-9_]{1,39}$/,
  nameMaxLength: 120,
  labelMaxLength: 120,
  minLevels: 2,
  maxLevels: 10,
  minValue: 0,
  maxValue: 100,
} as const;

/** Objeto de valor: un nivel de la escala. */
export interface ScaleLevel {
  readonly order: number;
  readonly label: string;
  readonly value: number;
  readonly countsAsAchievement: boolean;
}

/** Nivel sin posición: el orden lo deriva el lugar en la lista. */
export interface ScaleLevelInput {
  readonly label: string;
  readonly value: number;
  readonly countsAsAchievement: boolean;
}

export interface ResponseScaleProperties {
  readonly id: string;
  code: string;
  name: string;
  readonly type: ScaleType;
  levels: readonly ScaleLevel[];
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Alias de tipo (no interfaz) para que sirva como carga de auditoría. */
export type ResponseScaleSnapshot = {
  readonly code: string;
  readonly name: string;
  readonly type: ScaleType;
  readonly levels: readonly ScaleLevel[];
};

export class ResponseScale {
  private constructor(private readonly props: ResponseScaleProperties) {}

  public static create(rawProps: ResponseScaleProperties): ResponseScale {
    if (!SCALE_TYPES.includes(rawProps.type)) {
      throw new InvalidResponseScaleDataError('El tipo de la escala no es válido.');
    }
    return new ResponseScale({
      ...rawProps,
      code: ResponseScale.validateCode(rawProps.code),
      name: ResponseScale.validateName(rawProps.name),
      levels: ResponseScale.validateLevels(rawProps.levels),
    });
  }

  /** Asigna `order` consecutivo desde 1 según la posición de cada nivel. */
  public static levelsFromInputs(inputs: readonly ScaleLevelInput[]): ScaleLevel[] {
    return inputs.map((input, index) => ({
      order: index + 1,
      label: input.label,
      value: input.value,
      countsAsAchievement: input.countsAsAchievement,
    }));
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

  public get type(): ScaleType {
    return this.props.type;
  }

  public get levels(): readonly ScaleLevel[] {
    return this.props.levels;
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

  public snapshot(): ResponseScaleSnapshot {
    return {
      code: this.props.code,
      name: this.props.name,
      type: this.props.type,
      levels: this.props.levels.map((level) => ({ ...level })),
    };
  }

  public rename(name: string, actorId?: string): void {
    this.props.name = ResponseScale.validateName(name);
    this.touch(actorId);
  }

  public replaceLevels(inputs: readonly ScaleLevelInput[], actorId?: string): void {
    this.props.levels = ResponseScale.validateLevels(ResponseScale.levelsFromInputs(inputs));
    this.touch(actorId);
  }

  /** Copia los niveles a una escala nueva, editable, con otro código y nombre. */
  public duplicate(
    newId: string,
    code: string,
    name: string,
    actorId?: string,
    now: Date = new Date(),
  ): ResponseScale {
    return ResponseScale.create({
      id: newId,
      code,
      name,
      type: this.props.type,
      levels: this.props.levels.map((level) => ({ ...level })),
      createdBy: actorId ?? null,
      updatedBy: actorId ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  private touch(actorId?: string): void {
    if (actorId) {
      this.props.updatedBy = actorId;
    }
    this.props.updatedAt = new Date();
  }

  private static validateCode(rawCode: string): string {
    const code = rawCode.trim();
    if (!RESPONSE_SCALE_LIMITS.codeRegex.test(code)) {
      throw new InvalidResponseScaleDataError(
        'El código de la escala debe tener de 2 a 40 caracteres: mayúsculas, números y guion bajo, empezando por una letra.',
      );
    }
    return code;
  }

  private static validateName(rawName: string): string {
    const name = rawName.trim();
    if (name.length < 1 || name.length > RESPONSE_SCALE_LIMITS.nameMaxLength) {
      throw new InvalidResponseScaleDataError(
        `El nombre de la escala debe tener entre 1 y ${RESPONSE_SCALE_LIMITS.nameMaxLength} caracteres.`,
      );
    }
    return name;
  }

  private static validateLevels(rawLevels: readonly ScaleLevel[]): ScaleLevel[] {
    const { minLevels, maxLevels, minValue, maxValue, labelMaxLength } = RESPONSE_SCALE_LIMITS;

    if (rawLevels.length < minLevels || rawLevels.length > maxLevels) {
      throw new InvalidResponseScaleDataError(
        `La escala debe tener entre ${minLevels} y ${maxLevels} niveles.`,
      );
    }

    const values = new Set<number>();
    const labels = new Set<string>();

    return rawLevels.map((raw, index) => {
      if (raw.order !== index + 1) {
        throw new InvalidResponseScaleDataError(
          'El orden de los niveles debe ser consecutivo desde 1.',
        );
      }

      const label = typeof raw.label === 'string' ? raw.label.trim() : '';
      if (label.length < 1 || label.length > labelMaxLength) {
        throw new InvalidResponseScaleDataError(
          `La etiqueta de cada nivel debe tener entre 1 y ${labelMaxLength} caracteres.`,
        );
      }

      if (!Number.isInteger(raw.value) || raw.value < minValue || raw.value > maxValue) {
        throw new InvalidResponseScaleDataError(
          `El valor de cada nivel debe ser un entero entre ${minValue} y ${maxValue}.`,
        );
      }

      if (typeof raw.countsAsAchievement !== 'boolean') {
        throw new InvalidResponseScaleDataError(
          'Cada nivel debe indicar si cuenta como logro (verdadero o falso).',
        );
      }

      const labelKey = label.toLowerCase();
      if (values.has(raw.value)) {
        throw new InvalidResponseScaleDataError('Los valores de los niveles no se pueden repetir.');
      }
      if (labels.has(labelKey)) {
        throw new InvalidResponseScaleDataError(
          'Las etiquetas de los niveles no se pueden repetir.',
        );
      }
      values.add(raw.value);
      labels.add(labelKey);

      return {
        order: raw.order,
        label,
        value: raw.value,
        countsAsAchievement: raw.countsAsAchievement,
      };
    });
  }
}
