import type { TemplateVariable } from '../entities/template.js';
import type { TemplateRenderData } from './template-renderer.js';

export const OFFICIAL_MISSING_SCALAR_VALUE = '—';

export const ANNEX_MISSING_VALUE_TEXT: Readonly<Record<string, string>> = {
  'process.name': '(sin ejecución seleccionada)',
  'schedule.period': '(sin periodo definido)',
  'schedule.version': '(sin versión definida)',
  'minutes.number': '(sin acta registrada)',
  'minutes.convenedBy': '(sin convocante)',
  'minutes.dateTime': '(sin fecha registrada)',
  'minutes.modality': '(sin modalidad)',
  'studyPlan.number': '(sin plan de estudios)',
  'studyPlan.year': '(sin año definido)',
  'list.version': '(sin versión)',
  'plan.semester': '(sin semestres definidos)',
  'evaluation.student': '(sin estudiante)',
  'evaluation.course': '(sin asignatura)',
  'evaluation.date': '(sin fecha)',
  'evaluation.evaluator': '(sin evaluador)',
  'attribute.name': '(sin atributo seleccionado)',
  'course.name': '(sin asignatura seleccionada)',
  'course.cycleAndCurriculum': '(sin ciclo)',
  'teacher.name': '(sin docente)',
};

const DATA_REPEAT_PATTERN = /\bdata-repeat\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

function extractCollectionNames(content: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const match of content.matchAll(DATA_REPEAT_PATTERN)) {
    const name = (match[1] ?? match[2] ?? '').trim();
    if (name !== '' && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

/**
 * Completa los datos entregados por los proveedores para el render oficial de un anexo (D3):
 * cada variable declarada sin dato recibe «—» y toda colección sin filas queda vacía,
 * garantizando que nunca aparezca `{{clave}}` sin sustituir en el documento final.
 */
export function buildOfficialRenderData(
  variables: readonly TemplateVariable[],
  provided: Partial<TemplateRenderData>,
  content = '',
): TemplateRenderData {
  const scalars: Record<string, string> = { ...(provided.scalars ?? {}) };
  const collections: Record<string, readonly Readonly<Record<string, string>>[]> = {};

  if (provided.collections) {
    for (const [key, rows] of Object.entries(provided.collections)) {
      collections[key] = rows.map((row) => ({ ...row }));
    }
  }

  for (const collectionName of extractCollectionNames(content)) {
    if (!Object.prototype.hasOwnProperty.call(collections, collectionName)) {
      collections[collectionName] = [];
    }
  }

  for (const variable of variables) {
    if (
      !Object.prototype.hasOwnProperty.call(scalars, variable.key) ||
      scalars[variable.key] === undefined
    ) {
      scalars[variable.key] =
        ANNEX_MISSING_VALUE_TEXT[variable.key] ?? OFFICIAL_MISSING_SCALAR_VALUE;
    }
  }

  return { scalars, collections };
}
