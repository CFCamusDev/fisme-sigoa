import { STAKEHOLDER_IMPORT_MAX_ROWS } from '@sigoa/shared';
import ExcelJS from 'exceljs';
import type { StakeholderListType } from '../../domain/entities/stakeholder-list-enums.js';
import { ImportTemplateMismatchError } from '../../domain/errors/import-template-mismatch-error.js';
import { ImportTooManyRowsError } from '../../domain/errors/import-too-many-rows-error.js';
import { InvalidImportFileError } from '../../domain/errors/invalid-import-file-error.js';
import type { RawImportRow } from '../../domain/policies/analyze-stakeholder-import.js';
import {
  getStakeholderImportColumns,
  type StakeholderImportColumnKey,
} from '../../domain/policies/stakeholder-import-columns.js';
import type { StakeholderImportFileReader } from '../../domain/ports/stakeholder-import-file-reader.js';
import { ConcurrencyLimiter } from './concurrency-limiter.js';

const DEFAULT_MAX_CONCURRENT_READS = 2;
const DEFAULT_READ_TIMEOUT_MS = 5_000;

function hasZipSignature(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

function cellValueToText(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      const joined = value.richText
        .map((part) => part.text ?? '')
        .join('')
        .trim();
      return joined === '' ? null : joined;
    }
    if ('formula' in value || 'sharedFormula' in value) {
      const formulaValue = value as { formula?: string; result?: unknown };
      if (formulaValue.result !== undefined && formulaValue.result !== null) {
        if (typeof formulaValue.result === 'object' && 'error' in formulaValue.result) {
          return null;
        }
        return cellValueToText(formulaValue.result as ExcelJS.CellValue);
      }
      if (typeof formulaValue.formula === 'string') {
        const raw = `=${formulaValue.formula}`.trim();
        return raw === '=' ? null : raw;
      }
      return null;
    }
    if ('text' in value) {
      const text = String(value.text ?? '').trim();
      return text === '' ? null : text;
    }
    if ('hyperlink' in value) {
      const link = String(value.hyperlink ?? '').trim();
      return link === '' ? null : link;
    }
    if ('error' in value) {
      return null;
    }
  }
  return null;
}

export interface ExcelJsReaderOptions {
  readonly limiter?: ConcurrencyLimiter;
  readonly timeoutMs?: number;
  readonly maxRows?: number;
}

export class ExcelJsStakeholderImportFileReader implements StakeholderImportFileReader {
  private readonly limiter: ConcurrencyLimiter;
  private readonly timeoutMs: number;
  private readonly maxRows: number;

  constructor(options: ExcelJsReaderOptions = {}) {
    this.limiter = options.limiter ?? new ConcurrencyLimiter(DEFAULT_MAX_CONCURRENT_READS);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_READ_TIMEOUT_MS;
    this.maxRows = options.maxRows ?? STAKEHOLDER_IMPORT_MAX_ROWS;
  }

  public async read(buffer: Buffer, listType: StakeholderListType): Promise<RawImportRow[]> {
    if (!hasZipSignature(buffer)) {
      throw new InvalidImportFileError();
    }

    return this.limiter.run(() => this.readWithTimeout(buffer, listType));
  }

  private async readWithTimeout(
    buffer: Buffer,
    listType: StakeholderListType,
  ): Promise<RawImportRow[]> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new InvalidImportFileError('La lectura del archivo superó el tiempo máximo permitido.'),
        );
      }, this.timeoutMs);
    });

    try {
      return await Promise.race([this.parseWorkbook(buffer, listType), timeoutPromise]);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }

  private async parseWorkbook(
    buffer: Buffer,
    listType: StakeholderListType,
  ): Promise<RawImportRow[]> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new InvalidImportFileError();
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.actualRowCount === 0) {
      throw new InvalidImportFileError();
    }

    const expectedColumns = getStakeholderImportColumns(listType);
    const headerRow = worksheet.getRow(1);
    const actualHeaders = expectedColumns.map((_, index) =>
      cellValueToText(headerRow.getCell(index + 1).value),
    );
    const extraHeader = cellValueToText(headerRow.getCell(expectedColumns.length + 1).value);
    const matches =
      extraHeader === null &&
      expectedColumns.every((col, index) => actualHeaders[index] === col.header);

    if (!matches) {
      throw new ImportTemplateMismatchError();
    }

    const rows: RawImportRow[] = [];
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const values: Partial<Record<StakeholderImportColumnKey, string | null>> = {};
      let hasAnyValue = false;

      for (let index = 0; index < expectedColumns.length; index += 1) {
        const column = expectedColumns[index];
        if (!column) {
          continue;
        }
        const text = cellValueToText(row.getCell(index + 1).value);
        values[column.key] = text;
        if (text !== null) {
          hasAnyValue = true;
        }
      }

      if (!hasAnyValue) {
        continue;
      }

      if (rows.length >= this.maxRows) {
        throw new ImportTooManyRowsError(this.maxRows);
      }

      rows.push({
        rowNumber,
        values,
      });
    }

    return rows;
  }
}
