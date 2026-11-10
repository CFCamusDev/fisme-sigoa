import { assertParameterKey, assertParameterValueInRange } from '../policies/parameter-catalog.js';
import type { ParameterKey } from '../policies/parameter-catalog.js';

export interface ParameterProperties {
  readonly id: string;
  key: string;
  value: number;
  /** Nulo = valor por defecto del seed. */
  effectiveFromSemesterId: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Una versión de un parámetro: valor vigente desde un semestre (nulo = valor por defecto). */
export class Parameter {
  private constructor(private readonly props: ParameterProperties & { key: ParameterKey }) {}

  public static create(rawProps: ParameterProperties): Parameter {
    assertParameterKey(rawProps.key);
    assertParameterValueInRange(rawProps.key, rawProps.value);
    return new Parameter({ ...rawProps, key: rawProps.key });
  }

  public get id(): string {
    return this.props.id;
  }

  public get key(): ParameterKey {
    return this.props.key;
  }

  public get value(): number {
    return this.props.value;
  }

  public get effectiveFromSemesterId(): string | null {
    return this.props.effectiveFromSemesterId;
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
}
