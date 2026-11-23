import {
  STAKEHOLDER_DNI_PATTERN,
  STAKEHOLDER_GRADUATION_YEAR_MAX,
  STAKEHOLDER_GRADUATION_YEAR_MIN,
  STAKEHOLDER_RUC_PATTERN,
  type StakeholderKind,
} from '../entities/stakeholder-enums.js';
import type { StakeholderImportRowStatus } from '../entities/stakeholder-import-enums.js';
import type { StakeholderListType } from '../entities/stakeholder-list-enums.js';
import { Stakeholder, collectStakeholderDataErrors } from '../entities/stakeholder.js';
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

function parseGraduationYear(
  rawValue: string | null,
): { value: number | null } | { error: string } {
  if (rawValue === null) {
    return { value: null };
  }
  if (!/^\d+$/.test(rawValue)) {
    return {
      error: `El año de egreso debe ser un entero entre ${STAKEHOLDER_GRADUATION_YEAR_MIN} y ${STAKEHOLDER_GRADUATION_YEAR_MAX}.`,
    };
  }
  return { value: Number.parseInt(rawValue, 10) };
}

function inferFallbackKind(listType: StakeholderListType): StakeholderKind {
  return listType === 'EMPLOYER' ? 'INSTITUTION' : 'PERSON';
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
    const validDocument = 'error' in resolvedDoc ? null : (document as string);

    if (validDocument !== null) {
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
    }

    const rowErrors: string[] = [];
    if ('error' in resolvedDoc) {
      rowErrors.push(resolvedDoc.error);
    }

    const kind = 'error' in resolvedDoc ? inferFallbackKind(input.listType) : resolvedDoc.kind;
    const dni = 'error' in resolvedDoc ? (kind === 'PERSON' ? '00000000' : null) : resolvedDoc.dni;
    const ruc =
      'error' in resolvedDoc ? (kind === 'INSTITUTION' ? '00000000000' : null) : resolvedDoc.ruc;

    const parsedYear = parseGraduationYear(normalizeCellText(row.values.graduationYear));
    if ('error' in parsedYear) {
      rowErrors.push(parsedYear.error);
    }

    const rawEmail = normalizeCellText(row.values.email);
    const rawMobile = normalizeCellText(row.values.mobile);
    const rawPosition = normalizeCellText(row.values.position);
    const rawInstitution = normalizeCellText(row.values.institution);
    const rawSector = normalizeCellText(row.values.sector);
    const rawCycle = normalizeCellText(row.values.cycle);

    const dataErrors = collectStakeholderDataErrors({
      kind,
      fullName: fullName ?? '',
      dni,
      ruc,
      email: rawEmail,
      mobile: rawMobile,
      position: rawPosition,
      institution: kind === 'INSTITUTION' ? null : rawInstitution,
      sector: rawSector,
      graduationYear: 'error' in parsedYear ? null : parsedYear.value,
      cycle: rawCycle,
    });
    rowErrors.push(...dataErrors);

    if (rowErrors.length > 0) {
      const candidate = Stakeholder.create({
        id: 'candidate',
        kind,
        fullName: fullName ?? '',
        dni,
        ruc,
        email: rawEmail,
        mobile: rawMobile,
        position: rawPosition,
        institution: kind === 'INSTITUTION' ? null : rawInstitution,
        sector: rawSector,
        graduationYear: 'error' in parsedYear ? null : parsedYear.value,
        cycle: rawCycle,
        status: 'ACTIVE',
        voidReason: null,
        voidedAt: null,
        voidedBy: null,
        createdBy: input.actorId,
        createdAt: now,
        updatedAt: now,
      });

      try {
        buildStakeholderListMemberSnapshot(input.listType, candidate, {
          activity,
          representative,
        });
      } catch (error) {
        if (isDomainRowError(error)) {
          rowErrors.push(error.message);
        } else {
          throw error;
        }
      }

      totals.invalid += 1;
      analyzedRows.push(invalidRow(row.rowNumber, document, fullName, rowErrors));
      continue;
    }

    try {
      const stakeholder = Stakeholder.register({
        id: input.idGenerator(),
        kind,
        fullName: fullName ?? '',
        dni,
        ruc,
        email: rawEmail,
        mobile: rawMobile,
        position: rawPosition,
        institution: kind === 'INSTITUTION' ? null : rawInstitution,
        sector: rawSector,
        graduationYear: 'error' in parsedYear ? null : parsedYear.value,
        cycle: rawCycle,
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
