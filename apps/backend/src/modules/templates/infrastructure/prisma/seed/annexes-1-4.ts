import {
  MONTHS,
  documentHtml,
  fields,
  paragraph,
  repeatTable,
  section,
  signatures,
  td,
  tdRepeat,
  th,
  thRepeat,
  v,
} from './template-seed-layout.js';
import { defineTemplate } from './template-seed-types.js';

/** Cuerpo del acta (Anexo 2): I a VI y firmas del Comité de Calidad (RN-060, RN-062). */
export function minutesBody(): string {
  return [
    section(
      'I. Información general',
      fields([
        ['N° de acta', 'minutes.number'],
        ['Convocado por', 'minutes.convenedBy'],
        ['Fecha y hora', 'minutes.dateTime'],
        ['Modalidad (virtual, presencial o híbrida)', 'minutes.modality'],
        ['Enlace de la reunión', 'minutes.meetingUrl'],
        ['Enlace de la grabación', 'minutes.recordingUrl'],
      ]),
    ),
    section(
      'II. Puntos de agenda',
      repeatTable({
        head: [th('N°'), th('Punto de agenda')],
        collection: 'agenda',
        cells: [td(v('agenda.number')), td(v('agenda.item'))],
      }),
    ),
    section(
      'III. Lista de asistentes',
      repeatTable({
        head: [th('N°'), th('Nombre'), th('Cargo')],
        collection: 'attendees',
        cells: [td(v('attendees.number')), td(v('attendees.name')), td(v('attendees.role'))],
      }),
    ),
    section(
      'IV. Resultados obtenidos',
      repeatTable({
        head: [th('Código'), th('Enunciado'), th('Porcentaje por nivel'), th('Respuestas')],
        collection: 'results',
        cells: [
          td(v('results.code')),
          td(v('results.statement')),
          td(v('results.levels')),
          td(v('results.total')),
        ],
      }),
    ),
    section(
      'V. Aportes',
      repeatTable({
        head: [th('Código'), th('Aporte')],
        collection: 'contributions',
        cells: [td(v('contributions.code')), td(v('contributions.text'))],
      }),
    ),
    section(
      'VI. Evidencia fotográfica',
      repeatTable({
        head: [th('Descripción'), th('Imagen')],
        collection: 'evidence',
        cells: [
          td(v('evidence.caption')),
          td(
            `<img src="${v('evidence.url')}" alt="Evidencia de la sesión" style="max-width:70mm">`,
          ),
        ],
      }),
    ),
    section('Firmas del Comité de Calidad', signatures()),
  ].join('\n');
}

const anexo1 = defineTemplate({
  code: 'FO-01',
  name: 'Anexo 1. Cronograma',
  type: 'ANNEX',
  content: documentHtml({
    code: 'PR-M01.02.01-EPIS-001/FO-01',
    title: `Cronograma para ${v('process.name')}`,
    landscape: true,
    body: [
      fields([
        ['Periodo', 'schedule.period'],
        ['Versión del cronograma', 'schedule.version'],
      ]),
      repeatTable({
        head: [
          th('N°'),
          th('Actividad'),
          th('Responsable'),
          th('Meta'),
          th('Indicador'),
          ...MONTHS.map(([, label]) => th(label)),
        ],
        collection: 'activities',
        cells: [
          td(v('activities.number')),
          td(v('activities.name')),
          td(v('activities.responsible')),
          td(v('activities.goal')),
          td(v('activities.indicator')),
          ...MONTHS.map(([key]) => td(v(`activities.${key}`))),
        ],
      }),
      section('Aprobación', signatures()),
    ].join('\n'),
  }),
});

const anexo2 = defineTemplate({
  code: 'FO-02',
  name: 'Anexo 2. Acta',
  type: 'ANNEX',
  content: documentHtml({
    code: 'FO-02',
    title: 'Acta de sesión con constituyentes',
    body: minutesBody(),
  }),
});

const anexo3 = defineTemplate({
  code: 'FO-03',
  name: 'Anexo 3. Lista de constituyentes',
  type: 'ANNEX',
  content: documentHtml({
    code: 'FO-03',
    title: 'Lista de constituyentes',
    body: [
      fields([
        ['Plan de estudios N°', 'studyPlan.number'],
        ['Año de establecimiento', 'studyPlan.year'],
        ['Versión de la lista', 'list.version'],
      ]),
      section(
        'Comité Consultivo',
        repeatTable({
          head: [th('Actividad'), th('Institución'), th('Correo'), th('Celular')],
          collection: 'advisory',
          cells: [
            td(v('advisory.activity')),
            td(v('advisory.institution')),
            td(v('advisory.email')),
            td(v('advisory.phone')),
          ],
        }),
      ),
      section(
        'Empleadores',
        repeatTable({
          head: [
            th('Institución'),
            th('RUC'),
            th('Sector productivo'),
            th('Representante legal'),
            th('Correo'),
            th('Celular'),
            th('Cargo'),
          ],
          collection: 'employers',
          cells: [
            td(v('employers.institution')),
            td(v('employers.ruc')),
            td(v('employers.sector')),
            td(v('employers.legalRepresentative')),
            td(v('employers.email')),
            td(v('employers.phone')),
            td(v('employers.position')),
          ],
        }),
      ),
      section(
        'Graduados',
        repeatTable({
          head: [th('Nombres'), th('Año de egreso'), th('Correo'), th('Contacto')],
          collection: 'graduates',
          cells: [
            td(v('graduates.name')),
            td(v('graduates.graduationYear')),
            td(v('graduates.email')),
            td(v('graduates.contact')),
          ],
        }),
      ),
      section(
        'Estudiantes',
        repeatTable({
          head: [th('Nombres'), th('Ciclo'), th('Correo'), th('Contacto')],
          collection: 'students',
          cells: [
            td(v('students.name')),
            td(v('students.cycle')),
            td(v('students.email')),
            td(v('students.contact')),
          ],
        }),
      ),
      section(
        'Docentes',
        repeatTable({
          head: [th('Nombres'), th('Correo'), th('Contacto')],
          collection: 'teachers',
          cells: [td(v('teachers.name')), td(v('teachers.email')), td(v('teachers.contact'))],
        }),
      ),
    ].join('\n'),
  }),
});

const anexo4 = defineTemplate({
  code: 'FO-04',
  name: 'Anexo 4. Acciones de mejora',
  type: 'ANNEX',
  content: documentHtml({
    code: 'FO-04',
    title: `Plan de mejora para el semestre ${v('plan.semester')}`,
    landscape: true,
    body: [
      paragraph(
        'Las columnas de objetivos educacionales se generan desde la versión vigente del catálogo.',
      ),
      repeatTable({
        head: [
          th('Código'),
          th('Nombre'),
          th('Descripción'),
          th('Evidencias y enlace'),
          th('AG'),
          thRepeat('objectives', v('objectives.code')),
          th('Fecha o plazo'),
          th('Recursos'),
          th('Metas'),
          th('Responsable'),
          th('Estado de implementación'),
          th('Evaluación del impacto'),
        ],
        collection: 'actions',
        cells: [
          td(v('actions.code')),
          td(v('actions.name')),
          td(v('actions.description')),
          td(v('actions.evidence')),
          td(v('actions.attributes')),
          tdRepeat('objectives', v('actions.objectiveMark')),
          td(v('actions.deadline')),
          td(v('actions.resources')),
          td(v('actions.goals')),
          td(v('actions.responsible')),
          td(v('actions.status')),
          td(v('actions.impact')),
        ],
      }),
    ].join('\n'),
  }),
});

export const ANNEX_TEMPLATES_1_TO_4 = [anexo1, anexo2, anexo3, anexo4] as const;
