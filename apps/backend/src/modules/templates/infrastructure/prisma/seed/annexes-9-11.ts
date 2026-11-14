import {
  documentHtml,
  fields,
  paragraph,
  repeatTable,
  section,
  td,
  tdRepeat,
  th,
  thRepeat,
  v,
} from './template-seed-layout.js';
import { appliesToTable } from './annexes-5-8.js';
import { defineTemplate } from './template-seed-types.js';

const anexo9 = defineTemplate({
  code: 'FO-09',
  name: 'Anexo 9. Encuesta para establecer los AG',
  type: 'ANNEX',
  content: documentHtml({
    code: 'FO-09',
    title: 'Encuesta para establecer los atributos del graduado',
    body: [
      paragraph(
        'Un enunciado por atributo del graduado vigente; aplica a los cinco tipos de constituyentes.',
      ),
      appliesToTable(
        'attributes',
        'Atributo del graduado',
        ['student', 'teacher', 'graduate', 'advisory', 'employer'],
        false,
      ),
    ].join('\n'),
  }),
});

const anexo10 = defineTemplate({
  code: 'FO-10',
  name: 'Anexo 10. Encuesta para medir los AG',
  type: 'ANNEX',
  content: documentHtml({
    code: 'FO-10',
    title: 'Encuesta para medir los atributos del graduado',
    body: [
      paragraph(
        'La medición indirecta de los atributos del graduado aplica solo a graduados y empleadores.',
      ),
      appliesToTable('attributes', 'Atributo del graduado', ['graduate', 'employer'], false),
    ].join('\n'),
  }),
});

const anexo11 = defineTemplate({
  code: 'FO-11',
  name: 'Anexo 11. Procesamiento de la medición',
  type: 'ANNEX',
  content: documentHtml({
    code: 'FO-11',
    title: 'Procesamiento de la medición del atributo del graduado',
    landscape: true,
    body: [
      section(
        'I. Datos generales',
        fields([
          ['Atributo del graduado', 'attribute.name'],
          ['Asignatura', 'course.name'],
          ['Ciclo y currículo', 'course.cycleAndCurriculum'],
          ['Trabajo final o evidencia', 'course.evidence'],
          ['Docente responsable', 'teacher.name'],
        ]),
      ),
      section(
        'II. Resultados',
        [
          '<table>',
          `<thead><tr>${th('Resultado')}${thRepeat('indicators', v('indicators.code'))}</tr></thead>`,
          '<tbody>',
          `<tr>${td('Logrado')}${tdRepeat('indicators', v('indicators.achieved'))}</tr>`,
          `<tr>${td('No logrado')}${tdRepeat('indicators', v('indicators.notAchieved'))}</tr>`,
          `<tr>${td('Total de evaluados')}${tdRepeat('indicators', v('indicators.evaluated'))}</tr>`,
          `<tr>${td('Porcentaje de logro')}${tdRepeat('indicators', v('indicators.percentage'))}</tr>`,
          '</tbody>',
          '</table>',
          fields([
            ['Medición indirecta (porcentaje de logro)', 'results.indirect'],
            ['Meta de desempeño', 'results.goal'],
          ]),
        ].join('\n'),
      ),
      section(
        'III. Registro de medición directa',
        repeatTable({
          head: [
            th('N°'),
            th('Código'),
            th('Nombre del estudiante'),
            thRepeat('indicators', v('indicators.code')),
            th('Comentario del docente'),
          ],
          collection: 'students',
          cells: [
            td(v('students.number')),
            td(v('students.code')),
            td(v('students.name')),
            tdRepeat('indicators', v('students.score')),
            td(v('students.comment')),
          ],
        }),
      ),
    ].join('\n'),
  }),
});

export const ANNEX_TEMPLATES_9_TO_11 = [anexo9, anexo10, anexo11] as const;
