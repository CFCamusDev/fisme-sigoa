import { minutesBody } from './annexes-1-4.js';
import {
  blankFields,
  documentHtml,
  paragraph,
  repeatTable,
  section,
  td,
  tdRepeat,
  th,
  thRepeat,
  v,
} from './template-seed-layout.js';
import { defineTemplate } from './template-seed-types.js';

/** Preguntas abiertas estándar de mejora continua (RN §7.3). */
const OPEN_QUESTIONS = [
  '¿Qué características debería tener el profesional egresado del programa de estudios de Ingeniería de Sistemas de la UNTRM para desempeñarse con éxito?',
  '¿Cuáles son las tendencias que el programa de estudios debe considerar para formar al futuro profesional del programa?',
  'De acuerdo a su conocimiento del programa de estudios, ¿qué aspectos de mejora considera que se deben implementar?',
] as const;

/**
 * Formulario de encuesta: datos del encuestado (RN-051), un enunciado por elemento del catálogo
 * vigente con las opciones de la escala de respuesta (RN-052) y las preguntas abiertas (RN §7.3).
 */
function surveyBody(collection: 'objectives' | 'attributes', instruction: string): string {
  return [
    section(
      'Datos del encuestado',
      blankFields([
        'Nombres y apellidos',
        'DNI',
        'Cargo o institución',
        'Declaro participar voluntariamente en esta encuesta (Sí / No)',
      ]),
    ),
    section(
      'Enunciados',
      [
        paragraph(instruction),
        repeatTable({
          head: [th('Código'), th('Enunciado'), thRepeat('scale.levels', v('scale.levels.label'))],
          collection,
          cells: [
            td(v(`${collection}.code`)),
            td(v(`${collection}.statement`)),
            tdRepeat('scale.levels', '☐'),
          ],
        }),
      ].join('\n'),
    ),
    section(
      'Preguntas abiertas',
      OPEN_QUESTIONS.map(
        (question) =>
          `${paragraph(question)}\n<div class="blank"></div>\n<div class="blank"></div>`,
      ).join('\n'),
    ),
  ].join('\n');
}

const acta = defineTemplate({
  code: 'ACTA',
  name: 'Acta de sesión',
  type: 'MINUTES',
  content: documentHtml({
    code: 'ACTA',
    title: 'Acta de sesión con constituyentes',
    body: minutesBody(),
  }),
});

function survey(
  code: string,
  name: string,
  title: string,
  collection: 'objectives' | 'attributes',
  instruction: string,
) {
  return defineTemplate({
    code,
    name,
    type: 'SURVEY',
    content: documentHtml({ code, title, body: surveyBody(collection, instruction) }),
  });
}

const OBJECTIVES_INSTRUCTION =
  'Marca una opción de la escala por cada objetivo educacional del programa de estudios.';
const ATTRIBUTES_INSTRUCTION =
  'Marca una opción de la escala por cada atributo del graduado del programa de estudios.';

export const MINUTES_AND_SURVEY_TEMPLATES = [
  acta,
  survey(
    'ENC-A5',
    'Encuesta para establecer los OE (Anexo 5)',
    'Encuesta para establecer los objetivos educacionales',
    'objectives',
    OBJECTIVES_INSTRUCTION,
  ),
  survey(
    'ENC-A6',
    'Encuesta para medir los OE (Anexo 6)',
    'Encuesta para medir los objetivos educacionales',
    'objectives',
    OBJECTIVES_INSTRUCTION,
  ),
  survey(
    'ENC-A9',
    'Encuesta para establecer los AG (Anexo 9)',
    'Encuesta para establecer los atributos del graduado',
    'attributes',
    ATTRIBUTES_INSTRUCTION,
  ),
  survey(
    'ENC-A10',
    'Encuesta para medir los AG (Anexo 10)',
    'Encuesta para medir los atributos del graduado',
    'attributes',
    ATTRIBUTES_INSTRUCTION,
  ),
] as const;
