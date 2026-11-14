import {
  documentHtml,
  paragraph,
  repeatTable,
  tdRepeat,
  td,
  th,
  thRepeat,
  v,
} from './template-seed-layout.js';
import { defineTemplate } from './template-seed-types.js';

type Audience = 'student' | 'teacher' | 'graduate' | 'advisory' | 'employer';

const AUDIENCE_LABELS: Readonly<Record<Audience, string>> = {
  student: 'Estudiante',
  teacher: 'Docente',
  graduate: 'Graduado',
  advisory: 'Comité Consultivo',
  employer: 'Empleador',
};

/**
 * Matriz «aplica a» de las encuestas de los Anexos 5, 6, 9 y 10: un enunciado por elemento del
 * catálogo vigente (OE o AG) y una columna por tipo de constituyente que lo responde.
 */
export function appliesToTable(
  collection: 'objectives' | 'attributes',
  heading: string,
  audiences: readonly Audience[],
  studentNotApplicable: boolean,
): string {
  const audienceCell = (audience: Audience): string =>
    audience === 'student' && studentNotApplicable
      ? td('NA')
      : td(v(`${collection}.applies${audience.charAt(0).toUpperCase()}${audience.slice(1)}`));
  return repeatTable({
    head: [
      th('Código'),
      th(heading),
      ...audiences.map((audience) => th(AUDIENCE_LABELS[audience])),
    ],
    collection,
    cells: [
      td(v(`${collection}.code`)),
      td(v(`${collection}.statement`)),
      ...audiences.map(audienceCell),
    ],
  });
}

const FIVE_AUDIENCES: readonly Audience[] = [
  'student',
  'teacher',
  'graduate',
  'advisory',
  'employer',
];
const TWO_AUDIENCES: readonly Audience[] = ['graduate', 'employer'];

const anexo5 = defineTemplate({
  code: 'FO-05',
  name: 'Anexo 5. Encuesta para establecer los OE',
  type: 'ANNEX',
  content: documentHtml({
    code: 'FO-05',
    title: 'Encuesta para establecer los objetivos educacionales',
    body: [
      paragraph(
        'Un enunciado por objetivo educacional vigente. Los estudiantes no participan en el establecimiento de los objetivos (NA).',
      ),
      appliesToTable('objectives', 'Objetivo educacional', FIVE_AUDIENCES, true),
    ].join('\n'),
  }),
});

const anexo6 = defineTemplate({
  code: 'FO-06',
  name: 'Anexo 6. Encuesta para medir los OE',
  type: 'ANNEX',
  content: documentHtml({
    code: 'FO-06',
    title: 'Encuesta para medir los objetivos educacionales',
    body: [
      paragraph(
        'La medición de los objetivos educacionales aplica solo a graduados y empleadores.',
      ),
      appliesToTable('objectives', 'Objetivo educacional', TWO_AUDIENCES, false),
    ].join('\n'),
  }),
});

const anexo7 = defineTemplate({
  code: 'FO-07',
  name: 'Anexo 7. Plan Assessment',
  type: 'ANNEX',
  content: documentHtml({
    code: 'FO-07',
    title: 'Plan Assessment de los atributos del graduado',
    landscape: true,
    body: repeatTable({
      head: [
        th('Atributo del graduado'),
        th('Tipo de medición'),
        th('Enfocado en'),
        th('Peso (%)'),
        th('Método de assessment'),
        th('Cursos'),
        th('Evidencia'),
        th('Responsable de la medición'),
        th('Frecuencia'),
        th('Meta de desempeño'),
        thRepeat('semesters', v('semesters.code')),
      ],
      collection: 'attributes',
      cells: [
        td(`${v('attributes.code')} ${v('attributes.name')}`),
        td(v('assessment.measurementType')),
        td(v('assessment.focus')),
        td(v('assessment.weight')),
        td(v('assessment.method')),
        td(v('assessment.courses')),
        td(v('assessment.evidence')),
        td(v('assessment.responsible')),
        td(v('assessment.frequency')),
        td(v('assessment.target')),
        tdRepeat('semesters', v('assessment.result')),
      ],
    }),
  }),
});

const anexo8 = defineTemplate({
  code: 'FO-08',
  name: 'Anexo 8. Matriz de alineamiento',
  type: 'ANNEX',
  content: documentHtml({
    code: 'FO-08',
    title: 'Matriz de alineamiento entre cursos y atributos del graduado',
    landscape: true,
    body: [
      paragraph(
        'Las columnas de atributos del graduado se generan desde la versión vigente del catálogo.',
      ),
      repeatTable({
        head: [
          th('N°'),
          th('Ciclo'),
          th('Código'),
          th('Asignatura'),
          th('Créditos'),
          thRepeat('attributes', v('attributes.code')),
        ],
        collection: 'courses',
        cells: [
          td(v('courses.number')),
          td(v('courses.cycle')),
          td(v('courses.code')),
          td(v('courses.name')),
          td(v('courses.credits')),
          tdRepeat('attributes', v('courses.mark')),
        ],
      }),
    ].join('\n'),
  }),
});

export const ANNEX_TEMPLATES_5_TO_8 = [anexo5, anexo6, anexo7, anexo8] as const;
