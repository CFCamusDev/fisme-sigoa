import {
  STAKEHOLDER_DNI_PATTERN,
  STAKEHOLDER_GRADUATION_YEAR_MAX,
  STAKEHOLDER_GRADUATION_YEAR_MIN,
  STAKEHOLDER_RUC_PATTERN,
  type StakeholderKind,
} from '../entities/stakeholder-enums.js';
import type { StakeholderImportRowStatus } from '../entities/stakeholder-import-enums.js';
import type { StakeholderListType } from '../entities/stakeholder-list-enums.js';
import { Stakeholder } from '../entities/stakeholder.js';
import { IncompleteListMemberError } from '../errors/incomplete-list-member-error.js';
import { InvalidStakeholderDataError } from '../errors/invalid-stakeholder-data-error.js';
import { InvalidStakeholderListDataError } from '../errors/invalid-stakeholder-list-data-error.js';
import type { StakeholderImportColumnKey } from './stakeholder-import-columns.js';
import {
  buildStakeholderListMemberSnapshot,
  type StakeholderListMemberSnapshotFields,
} from './stakeholder-list-type-fields.js';

export interface RawImportRow {
  readonly rowNumber: number;
  readonly values: Partial<Record<StakeholderImportColumnKey, string | null>>;
}

export interface AnalyzedImportRowMemberData {
  readonly stakeholderId: string;
  readonly snapshot: StakeholderListMemberSnapshotFields;
}

export interface AnalyzedImportRow {
  readonly rowNumber: number;
  readonly status: StakeholderImportRowStatus;
  readonly document: string | null;
  readonly fullName: string | null;
  readonly errors: readonly string[];
  readonly stakeholderToCreate: Stakeholder | null;
  readonly memberToAdd: AnalyzedImportRowMemberData | null;
}

export interface AnalyzeStakeholderImportInput {
  readonly listType: StakeholderListType;
  readonly rows: readonly RawImportRow[];
  readonly existingByDocument: ReadonlyMap<string, Stakeholder>;
  readonly memberStakeholderIds: ReadonlySet<string>;
  readonly idGenerator: () => string;
  readonly actorId: string;
  readonly now?: Date;
}

export interface AnalyzeStakeholderImportResult {
  readonly rows: readonly AnalyzedImportRow[];
  readonly totals: {
    readonly total: number;
    readonly new: number;
    readonly existing: number;
    readonly alreadyInList: number;
    readonly invalid: number;
  };
}

function normalizeCellText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Normaliza un documento crudo de Excel rellenando con ceros a la izquierda
 * cuando Excel convirtió el número y perdió los ceros iniciales.
 */
export function normalizeImportDocument(
  listType: StakeholderListType,
  rawDocument: string | null | undefined,
): string | null {
  const normalized = normalizeCellText(rawDocument);
  if (normalized === null) {
    return null;
  }
  if (!/^\d+$/.test(normalized)) {
    return normalized;
  }
  if (listType === 'EMPLOYER') {
    return normalized.length >= 9 && normalized.length <= 11
      ? normalized.padStart(11, '0')
      : normalized;
  }
  if (listType === 'ADVISORY_BOARD') {
    if (normalized.length >= 6 && normalized.length <= 8) {
      return normalized.padStart(8, '0');
    }
    return normalized.length >= 9 && normalized.length <= 11
      ? normalized.padStart(11, '0')
      : normalized;
  }
  return normalized.length >= 6 && normalized.length <= 8
    ? normalized.padStart(8, '0')
    : normalized;
}

function resolveDocumentAndKind(
  listType: StakeholderListType,
  document: string | null,
): { kind: StakeholderKind; dni: string | null; ruc: string | null } | { error: string } {
  if (document === null) {
    if (listType === 'EMPLOYER') {
      return { error: 'El RUC es obligatorio y debe tener 11 dígitos.' };
    }
    if (listType === 'ADVISORY_BOARD') {
      return { error: 'El DNI (8 dígitos) o RUC (11 dígitos) es obligatorio.' };
    }
    return { error: 'El DNI es obligatorio y debe tener 8 dígitos.' };
  }

  if (listType === 'EMPLOYER') {
    if (!STAKEHOLDER_RUC_PATTERN.test(document)) {
      return { error: 'El RUC debe tener exactamente 11 dígitos numéricos.' };
    }
    return { kind: 'INSTITUTION', dni: null, ruc: document };
  }

  if (listType === 'ADVISORY_BOARD') {
    if (STAKEHOLDER_DNI_PATTERN.test(document)) {
      return { kind: 'PERSON', dni: document, ruc: null };
    }
    if (STAKEHOLDER_RUC_PATTERN.test(document)) {
      return { kind: 'INSTITUTION', dni: null, ruc: document };
    }
    return { error: 'El documento debe ser un DNI de 8 dígitos o un RUC de 11 dígitos.' };
  }

  if (!STAKEHOLDER_DNI_PATTERN.test(document)) {
    return { error: 'El DNI debe tener exactamente 8 dígitos numéricos.' };
  }
  return { kind: 'PERSON', dni: document, ruc: null };
}

function parseGraduationYear(rawValue: string | null): number | null {
  if (rawValue === null) {
    return null;
  }
  if (!/^\d+$/.test(rawValue)) {
    throw new InvalidStakeholderDataError(
      `El año de egreso debe ser un entero entre ${STAKEHOLDER_GRADUATION_YEAR_MIN} y ${STAKEHOLDER_GRADUATION_YEAR_MAX}.`,
    );
  }
  return Number.parseInt(rawValue, 10);
}

function invalidRow(
  rowNumber: number,
  document: string | null,
  fullName: string | null,
  errors: readonly string[],
): AnalyzedImportRow {
  return {
    rowNumber,
    status: 'INVALID',
    document,
    fullName,
    errors,
    stakeholderToCreate: null,
    memberToAdd: null,
  };
}

function isDomainRowError(error: unknown): error is Error {
  return (
    error instanceof InvalidStakeholderDataError ||
    error instanceof InvalidStakeholderListDataError ||
    error instanceof IncompleteListMemberError
  );
}

/**
 * Clasifica cada fila del archivo Excel en NEW, EXISTING, ALREADY_IN_LIST o INVALID,
 * reutilizando las reglas de Stakeholder y del Anexo 3 sin duplicar validaciones.
 */
export function analyzeStakeholderImport(
  input: AnalyzeStakeholderImportInput,
): AnalyzeStakeholderImportResult {
  const seenDocuments = new Set<string>();
  const analyzedRows: AnalyzedImportRow[] = [];
  const totals = {
    total: input.rows.length,
    new: 0,
    existing: 0,
    alreadyInList: 0,
    invalid: 0,
  };
  const now = input.now ?? new Date();

  for (const row of input.rows) {
    const document = normalizeImportDocument(input.listType, row.values.document);
    const fullName = normalizeCellText(row.values.fullName);
    const representative = normalizeCellText(row.values.representative);
    const activity = normalizeCellText(row.values.activity);

    const resolvedDoc = resolveDocumentAndKind(input.listType, document);
    if ('error' in resolvedDoc) {
      totals.invalid += 1;
      analyzedRows.push(invalidRow(row.rowNumber, document, fullName, [resolvedDoc.error]));
      continue;
    }

    // `document` es no nulo porque `resolveDocumentAndKind` ya lo validó.
    const validDocument = document as string;
    if (seenDocuments.has(validDocument)) {
      totals.invalid += 1;
      analyzedRows.push(
        invalidRow(row.rowNumber, validDocument, fullName, [
          'El documento está repetido dentro del archivo.',
        ]),
      );
      continue;
    }
    seenDocuments.add(validDocument);

    const existing = input.existingByDocument.get(validDocument);
    if (existing) {
      if (existing.status === 'VOIDED') {
        totals.invalid += 1;
        analyzedRows.push(
          invalidRow(row.rowNumber, validDocument, existing.fullName, [
            'El constituyente con este documento está anulado.',
          ]),
        );
        continue;
      }

      try {
        const snapshot = buildStakeholderListMemberSnapshot(input.listType, existing, {
          activity,
          representative,
        });

        if (input.memberStakeholderIds.has(existing.id)) {
          totals.alreadyInList += 1;
          analyzedRows.push({
            rowNumber: row.rowNumber,
            status: 'ALREADY_IN_LIST',
            document: validDocument,
            fullName: existing.fullName,
            errors: [],
            stakeholderToCreate: null,
            memberToAdd: null,
          });
          continue;
        }

        totals.existing += 1;
        analyzedRows.push({
          rowNumber: row.rowNumber,
          status: 'EXISTING',
          document: validDocument,
          fullName: existing.fullName,
          errors: [],
          stakeholderToCreate: null,
          memberToAdd: {
            stakeholderId: existing.id,
            snapshot,
          },
        });
      } catch (error) {
        if (error instanceof IncompleteListMemberError) {
          totals.invalid += 1;
          analyzedRows.push(
            invalidRow(row.rowNumber, validDocument, existing.fullName, [
              `${error.message} Edita el registro maestro antes de importar.`,
            ]),
          );
          continue;
        }
        if (isDomainRowError(error)) {
          totals.invalid += 1;
          analyzedRows.push(
            invalidRow(row.rowNumber, validDocument, existing.fullName, [error.message]),
          );
          continue;
        }
        throw error;
      }
      continue;
    }

    try {
      const graduationYear = parseGraduationYear(normalizeCellText(row.values.graduationYear));
      const institution = normalizeCellText(row.values.institution);
      const stakeholder = Stakeholder.register({
        id: input.idGenerator(),
        kind: resolvedDoc.kind,
        fullName: fullName ?? '',
        dni: resolvedDoc.dni,
        ruc: resolvedDoc.ruc,
        email: normalizeCellText(row.values.email),
        mobile: normalizeCellText(row.values.mobile),
        position: normalizeCellText(row.values.position),
        institution: resolvedDoc.kind === 'INSTITUTION' ? null : institution,
        sector: normalizeCellText(row.values.sector),
        graduationYear,
        cycle: normalizeCellText(row.values.cycle),
        actorId: input.actorId,
        now,
      });

      const snapshot = buildStakeholderListMemberSnapshot(input.listType, stakeholder, {
        activity,
        representative,
      });

      totals.new += 1;
      analyzedRows.push({
        rowNumber: row.rowNumber,
        status: 'NEW',
        document: validDocument,
        fullName: stakeholder.fullName,
        errors: [],
        stakeholderToCreate: stakeholder,
        memberToAdd: {
          stakeholderId: stakeholder.id,
          snapshot,
        },
      });
    } catch (error) {
      if (isDomainRowError(error)) {
        totals.invalid += 1;
        analyzedRows.push(invalidRow(row.rowNumber, validDocument, fullName, [error.message]));
        continue;
      }
      throw error;
    }
  }

  return {
    rows: analyzedRows,
    totals,
  };
}
