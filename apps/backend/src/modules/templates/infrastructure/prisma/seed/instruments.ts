import { documentHtml, fields, note, section, table, td, th } from './template-seed-layout.js';
import { defineTemplate } from './template-seed-types.js';

/**
 * Instrumentos de ejemplo (RN-070, RN-071). Los nombres de los criterios y las escalas salen de
 * los instrumentos reales; los descriptores por nivel y los aspectos de la guía y la lista no
 * figuran en los documentos de negocio y se siembran como texto neutro que el docente adapta.
 */

const EVALUATION_FIELDS: readonly (readonly [string, string])[] = [
  ['Estudiante', 'evaluation.student'],
  ['Asignatura', 'evaluation.course'],
  ['Fecha de evaluación', 'evaluation.date'],
  ['Evaluador', 'evaluation.evaluator'],
];

interface RubricLevel {
  readonly label: string;
  readonly points: number;
}

function rubricBody(
  criteria: readonly string[],
  levels: readonly RubricLevel[],
  totalPoints: number,
): string {
  return [
    fields(EVALUATION_FIELDS),
    section(
      'Rúbrica analítica',
      table(
        [
          th('Criterio'),
          ...levels.map((level) => th(`${level.label} (${level.points})`)),
          th('Puntaje'),
        ],
        criteria.map((criterion) => [
          td(criterion),
          ...levels.map((level) => td(`Descriptor del nivel ${level.label}`)),
          td(''),
        ]),
      ),
    ),
    note(`Puntaje total: ______ / ${totalPoints}`),
  ].join('\n');
}

const TESIS2_RUBRIC_LEVELS: readonly RubricLevel[] = [
  { label: 'Excelente', points: 4 },
  { label: 'Bueno', points: 3 },
  { label: 'Regular', points: 2 },
  { label: 'Deficiente', points: 1 },
  { label: 'No evidencia', points: 0 },
];

const GPTI_RUBRIC_LEVELS: readonly RubricLevel[] = [
  { label: 'Excelente', points: 5 },
  { label: 'Bueno', points: 4 },
  { label: 'Regular', points: 3 },
  { label: 'No logrado', points: 2 },
];

const numbered = (prefix: string, count: number): string[] =>
  Array.from({ length: count }, (_unused, index) => `${prefix} ${index + 1}`);

const rubricTesis2 = defineTemplate({
  code: 'INS-RUBRIC-TESIS2',
  name: 'Rúbrica de ejemplo: Tesis II',
  type: 'INSTRUMENT',
  content: documentHtml({
    code: 'INS-RUBRIC-TESIS2',
    title: 'Rúbrica analítica de ejemplo: Tesis II',
    body: rubricBody(
      [
        'Delimitación y título de la investigación',
        'Coherencia entre el problema, los objetivos y las preguntas',
        'Triangulación empírica',
        'Introducción académica',
        'Competencias científicas',
      ],
      TESIS2_RUBRIC_LEVELS,
      20,
    ),
  }),
});

const observationTesis2 = defineTemplate({
  code: 'INS-OBS-TESIS2',
  name: 'Guía de observación de ejemplo: Tesis II',
  type: 'INSTRUMENT',
  content: documentHtml({
    code: 'INS-OBS-TESIS2',
    title: 'Guía de observación de ejemplo: Tesis II',
    body: [
      fields(EVALUATION_FIELDS),
      section(
        'Aspectos observados',
        table(
          [
            th('Aspecto observado'),
            th('Sí'),
            th('No'),
            th('Evidencia registrada'),
            th('Observaciones'),
          ],
          numbered('Aspecto observado', 10).map((aspect) => [
            td(aspect),
            td('☐'),
            td('☐'),
            td(''),
            td(''),
          ]),
        ),
      ),
    ].join('\n'),
  }),
});

const checklistTesis2 = defineTemplate({
  code: 'INS-CHECK-TESIS2',
  name: 'Lista de cotejo de ejemplo: Tesis II',
  type: 'INSTRUMENT',
  content: documentHtml({
    code: 'INS-CHECK-TESIS2',
    title: 'Lista de cotejo de ejemplo: Tesis II',
    body: [
      fields(EVALUATION_FIELDS),
      section(
        'Criterios',
        table(
          [th('Criterio'), th('Sí (2)'), th('No (0)'), th('Observaciones')],
          numbered('Criterio', 10).map((criterion) => [td(criterion), td('☐'), td('☐'), td('')]),
        ),
      ),
      note('Puntaje total: ______ / 20 (10 criterios; Sí = 2 puntos, No = 0 puntos).'),
    ].join('\n'),
  }),
});

const rubricGpti = defineTemplate({
  code: 'INS-RUBRIC-GPTI',
  name: 'Rúbrica de ejemplo: Gestión de Proyectos de TI',
  type: 'INSTRUMENT',
  content: documentHtml({
    code: 'INS-RUBRIC-GPTI',
    title: 'Rúbrica analítica de ejemplo: Gestión de Proyectos de TI',
    body: rubricBody(
      [
        'Comprensión conceptual',
        'Relaciones y diferencias',
        'Calidad visual del mapa',
        'Integración con PMBOK 7',
      ],
      GPTI_RUBRIC_LEVELS,
      20,
    ),
  }),
});

export const INSTRUMENT_TEMPLATES = [
  rubricTesis2,
  observationTesis2,
  checklistTesis2,
  rubricGpti,
] as const;
