import type {
  CatalogAttributeDto,
  CatalogComparisonDto,
  CatalogObjectiveDto,
  CatalogVersionDetailDto,
  CatalogVersionDto,
  CatalogVersionHistoryDto,
  ListCatalogVersionsResponse,
} from '@sigoa/shared';

export function buildCatalogVersion(overrides: Partial<CatalogVersionDto> = {}): CatalogVersionDto {
  return {
    id: 'cv-1',
    programId: 'program-1',
    number: 1,
    status: 'APPROVED',
    basedOnVersionId: null,
    objectiveCount: 4,
    attributeCount: 12,
    createdAt: '2026-11-01T15:00:00.000Z',
    ...overrides,
  };
}

/** Versión 1 vigente; con `open` se agrega la versión 2 abierta que parte de ella. */
export function buildCatalogVersionsResponse(
  options: { open?: 'DRAFT' | 'IN_VALIDATION' } = {},
): ListCatalogVersionsResponse {
  const current = buildCatalogVersion();
  if (!options.open) {
    return { items: [current] };
  }
  return {
    items: [
      buildCatalogVersion({
        id: 'cv-2',
        number: 2,
        status: options.open,
        basedOnVersionId: 'cv-1',
        createdAt: '2026-11-12T15:00:00.000Z',
      }),
      current,
    ],
  };
}

export function buildCatalogObjective(
  order: number,
  overrides: Partial<CatalogObjectiveDto> = {},
): CatalogObjectiveDto {
  return {
    id: `oe-${order}`,
    code: `OEP${order}`,
    statement: `Enunciado del objetivo ${order}.`,
    order,
    updatedAt: '2026-11-01T15:00:00.000Z',
    ...overrides,
  };
}

export function buildCatalogAttribute(
  order: number,
  overrides: Partial<CatalogAttributeDto> = {},
): CatalogAttributeDto {
  const suffix = String(order).padStart(2, '0');
  return {
    id: `ag-${order}`,
    code: `AG-C${suffix}`,
    name: `Atributo ${order}`,
    statement: `Enunciado del atributo ${order}.`,
    order,
    updatedAt: '2026-11-01T15:00:00.000Z',
    ...overrides,
  };
}

/** Detalle con `objectiveCount` OE y `attributeCount` AG; por defecto pocos para pruebas ágiles. */
export function buildCatalogVersionDetail(
  options: {
    version?: Partial<CatalogVersionDto>;
    objectiveCount?: number;
    attributeCount?: number;
    objectives?: CatalogObjectiveDto[];
    attributes?: CatalogAttributeDto[];
    history?: CatalogVersionHistoryDto;
  } = {},
): CatalogVersionDetailDto {
  const objectives =
    options.objectives ??
    Array.from({ length: options.objectiveCount ?? 3 }, (_, index) =>
      buildCatalogObjective(index + 1),
    );
  const attributes =
    options.attributes ??
    Array.from({ length: options.attributeCount ?? 3 }, (_, index) =>
      buildCatalogAttribute(index + 1),
    );
  return {
    version: buildCatalogVersion({
      id: 'cv-2',
      number: 2,
      status: 'DRAFT',
      basedOnVersionId: 'cv-1',
      objectiveCount: objectives.length,
      attributeCount: attributes.length,
      ...options.version,
    }),
    history: options.history ?? { validFrom: null, validUntil: null, resolutions: [] },
    objectives,
    attributes,
  };
}

/** Comparación de la versión 1 (Histórica) con la 2 (vigente): un OE de cada tipo de cambio. */
export function buildCatalogComparison(
  overrides: Partial<CatalogComparisonDto> = {},
): CatalogComparisonDto {
  return {
    base: {
      version: buildCatalogVersion({
        id: 'cv-1',
        number: 1,
        status: 'HISTORICAL',
        objectiveCount: 3,
        attributeCount: 0,
      }),
      history: {
        validFrom: '2024-03-01T10:00:00.000Z',
        validUntil: '2026-05-10T09:00:00.000Z',
        resolutions: [
          {
            id: 'res-1',
            type: 'EDUCATIONAL_OBJECTIVE',
            number: '128-2024',
            issuedOn: '2024-02-20',
            status: 'APPROVED',
            approvedAt: '2024-03-01T10:00:00.000Z',
            hasPdf: true,
          },
        ],
      },
    },
    target: {
      version: buildCatalogVersion({
        id: 'cv-2',
        number: 2,
        status: 'APPROVED',
        basedOnVersionId: 'cv-1',
        objectiveCount: 3,
        attributeCount: 0,
      }),
      history: { validFrom: null, validUntil: null, resolutions: [] },
    },
    summary: { added: 1, removed: 1, modified: 1, unchanged: 1 },
    objectives: [
      {
        code: 'OEP1',
        change: 'MODIFIED',
        base: { statement: 'Formar ingenieros éticos.' },
        target: { statement: 'Formar ingenieros líderes.' },
        nameSegments: [],
        statementSegments: [
          { type: 'EQUAL', text: 'Formar ingenieros ' },
          { type: 'REMOVED', text: 'éticos.' },
          { type: 'ADDED', text: 'líderes.' },
        ],
      },
      {
        code: 'OEP2',
        change: 'UNCHANGED',
        base: { statement: 'Texto estable.' },
        target: { statement: 'Texto estable.' },
        nameSegments: [],
        statementSegments: [{ type: 'EQUAL', text: 'Texto estable.' }],
      },
      {
        code: 'OEP5',
        change: 'ADDED',
        base: null,
        target: { statement: 'Fomentar el emprendimiento.' },
        nameSegments: [],
        statementSegments: [{ type: 'ADDED', text: 'Fomentar el emprendimiento.' }],
      },
      {
        code: 'OEP4',
        change: 'REMOVED',
        base: { statement: 'Promover la investigación.' },
        target: null,
        nameSegments: [],
        statementSegments: [{ type: 'REMOVED', text: 'Promover la investigación.' }],
      },
    ],
    attributes: [],
    ...overrides,
  };
}
