import { InvalidTemplateDataError } from '../errors/invalid-template-data-error.js';

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;

export interface OfficialDownloadRecordProperties {
  readonly templateId: string;
  readonly templateCode: string;
  readonly versionId: string;
  readonly versionNumber: number;
  readonly pdfSha256: string;
  readonly pdfBytes: number;
  readonly generatedAt: Date;
}

export type OfficialDownloadAuditPayload = {
  readonly templateId: string;
  readonly templateCode: string;
  readonly versionId: string;
  readonly versionNumber: number;
  readonly pdfSha256: string;
  readonly pdfBytes: number;
  readonly generatedAt: string;
};

/**
 * Registro de metadatos de una descarga oficial de anexo en PDF para auditoría (HU-070, CA2).
 * Nunca almacena el binario PDF ni el HTML renderizado.
 */
export class OfficialDownloadRecord {
  private constructor(private readonly props: OfficialDownloadRecordProperties) {}

  public static create(rawProps: OfficialDownloadRecordProperties): OfficialDownloadRecord {
    if (rawProps.templateId.trim().length === 0) {
      throw new InvalidTemplateDataError('El identificador de la plantilla no puede estar vacío.');
    }
    if (rawProps.templateCode.trim().length === 0) {
      throw new InvalidTemplateDataError('El código de la plantilla no puede estar vacío.');
    }
    if (rawProps.versionId.trim().length === 0) {
      throw new InvalidTemplateDataError('El identificador de la versión no puede estar vacío.');
    }
    if (!Number.isInteger(rawProps.versionNumber) || rawProps.versionNumber < 1) {
      throw new InvalidTemplateDataError(
        'El número de versión debe ser un entero mayor o igual a 1.',
      );
    }
    if (!SHA256_HEX_PATTERN.test(rawProps.pdfSha256)) {
      throw new InvalidTemplateDataError(
        'El hash SHA-256 del PDF debe tener 64 caracteres hexadecimales.',
      );
    }
    if (!Number.isInteger(rawProps.pdfBytes) || rawProps.pdfBytes <= 0) {
      throw new InvalidTemplateDataError('El tamaño del PDF debe ser mayor a cero.');
    }
    if (!(rawProps.generatedAt instanceof Date) || Number.isNaN(rawProps.generatedAt.getTime())) {
      throw new InvalidTemplateDataError('La fecha de generación no es válida.');
    }

    return new OfficialDownloadRecord({
      ...rawProps,
      templateCode: rawProps.templateCode.trim(),
      pdfSha256: rawProps.pdfSha256.toLowerCase(),
    });
  }

  public get templateId(): string {
    return this.props.templateId;
  }

  public get templateCode(): string {
    return this.props.templateCode;
  }

  public get versionId(): string {
    return this.props.versionId;
  }

  public get versionNumber(): number {
    return this.props.versionNumber;
  }

  public get pdfSha256(): string {
    return this.props.pdfSha256;
  }

  public get pdfBytes(): number {
    return this.props.pdfBytes;
  }

  public get generatedAt(): Date {
    return this.props.generatedAt;
  }

  public toAuditPayload(): OfficialDownloadAuditPayload {
    return {
      templateId: this.props.templateId,
      templateCode: this.props.templateCode,
      versionId: this.props.versionId,
      versionNumber: this.props.versionNumber,
      pdfSha256: this.props.pdfSha256,
      pdfBytes: this.props.pdfBytes,
      generatedAt: this.props.generatedAt.toISOString(),
    };
  }
}
