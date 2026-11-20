import type { ProcessType } from '../entities/process-type.js';

export interface ProcedureStepDefinition {
  readonly activity: string;
  readonly responsible: string;
  readonly goal: string | null;
}

export interface ProposedScheduleActivityDraft extends ProcedureStepDefinition {
  readonly number: number;
}

export const PROCEDURE_STEPS: Record<ProcessType, readonly ProcedureStepDefinition[]> = {
  P611: [
    {
      activity:
        'Elaborar cronograma para el establecimiento y validación de OE y las encuestas (aplicación virtual)',
      responsible: 'Presidente',
      goal: 'Anexo 1, Anexo 5',
    },
    {
      activity: 'Proponer los OE y elaborar el acta donde queden registrados',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Identificar a los constituyentes que validarán OE y AG',
      responsible: 'Presidente',
      goal: 'Anexo 3',
    },
    {
      activity: 'Convocar al Comité Consultivo para validar los OE propuestos',
      responsible: 'Presidente',
      goal: 'Anexo 2 (precisa validación)',
    },
    {
      activity: 'Convocar a los Empleadores para validar los OE',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Convocar a los Graduados para validar los OE',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Convocar a los Docentes para validar los OE',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Consolidar y analizar aportes; establecer versión final',
      responsible: 'Presidente',
      goal: 'Anexo 2 (validación final)',
    },
    {
      activity: 'Aprobar los OE mediante resolución de decanato',
      responsible: 'Decano',
      goal: 'Resolución',
    },
    {
      activity: 'Gestionar la publicación de los OE en la web institucional',
      responsible: 'Presidente, Jefes de Unidad',
      goal: 'Publicación',
    },
  ],
  P612: [
    {
      activity: 'Elaborar y aprobar el cronograma de medición incluyendo las encuestas de medición',
      responsible: 'Presidente',
      goal: 'Anexo 1, Anexo 6',
    },
    {
      activity: 'Medir los OE con los Empleadores',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Medir los OE con los Graduados',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Consolidar y analizar aportes',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Identificar acciones de mejora',
      responsible: 'Presidente',
      goal: 'Anexo 4',
    },
    {
      activity: 'Aprobar con acto resolutivo el Plan de Mejora (OE y AG)',
      responsible: 'Decano',
      goal: 'Resolución',
    },
    {
      activity: 'Implementar el Plan de Mejora',
      responsible: 'Docentes',
      goal: null,
    },
    {
      activity: 'Seguimiento de la ejecución del Plan de Mejora',
      responsible: 'Presidente',
      goal: null,
    },
    {
      activity: 'Informes de las acciones implementadas',
      responsible: 'Docentes',
      goal: 'Informe',
    },
  ],
  P613: [
    {
      activity: 'Elaborar el cronograma incluyendo los instrumentos de revisión',
      responsible: 'Presidente',
      goal: 'Anexo 1',
    },
    {
      activity: 'Proponer la mejora de los OE considerando los resultados de las mediciones',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Reunión con el Comité Consultivo para revisión y validación',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Reunión con los Empleadores',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Reunión con los Docentes',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Reunión con los Graduados',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Consolidar y analizar aportes para su actualización',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Aprobar los OE mediante acto resolutivo',
      responsible: 'Decano',
      goal: 'Resolución',
    },
    {
      activity: 'Gestionar la actualización en la web institucional',
      responsible: 'Presidente',
      goal: 'Publicación',
    },
  ],
  P621: [
    {
      activity: 'Elaborar el cronograma y las encuestas (aplicación virtual)',
      responsible: 'Presidente',
      goal: 'Anexo 1, Anexo 9',
    },
    {
      activity: 'Analizar los AG del modelo de acreditación ICACIT',
      responsible: 'Presidente',
      goal: null,
    },
    {
      activity: 'Identificar y seleccionar los AG según las características del programa',
      responsible: 'Presidente',
      goal: null,
    },
    {
      activity: 'Proponer los AG seleccionados y elaborar acta',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Los constituyentes que validaron los OE validarán los AG (salvo actualización)',
      responsible: 'Presidente',
      goal: 'Anexo 3',
    },
    {
      activity: 'Reunión de validación con el Comité Consultivo',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Reunión de validación con los Empleadores',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Reunión de validación con los Graduados',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Reunión de validación con los Docentes',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Reunión de validación con los Estudiantes',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Consolidar aportes y establecer versión final',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Aprobar los AG mediante resolución de decanato',
      responsible: 'Decano',
      goal: 'Resolución',
    },
    {
      activity: 'Gestionar la actualización de los AG en la web',
      responsible: 'Presidente, Jefes de Unidad',
      goal: 'Publicación',
    },
  ],
  P622: [
    {
      activity: 'Análisis y alineamiento de los cursos del plan de estudios con los AG',
      responsible: 'Docentes',
      goal: 'Anexo 8',
    },
    {
      activity: 'Identificar a los docentes responsables de la medición directa',
      responsible: 'Presidente',
      goal: null,
    },
    {
      activity: 'Elaborar/actualizar los instrumentos de medición directa (rúbrica)',
      responsible: 'Docentes',
      goal: 'Instrumento',
    },
    {
      activity: 'Elaborar/actualizar las guías de trabajo final de los cursos seleccionados',
      responsible: 'Docentes',
      goal: 'Guía',
    },
    {
      activity: 'Elaborar el plan de medición directa — Plan Assessment',
      responsible: 'Presidente',
      goal: 'Anexo 7',
    },
    {
      activity: 'Aplicar el instrumento de medición directa',
      responsible: 'Docentes',
      goal: null,
    },
    {
      activity: 'Procesar las mediciones de los estudiantes',
      responsible: 'Docentes',
      goal: 'Anexo 11',
    },
    {
      activity: 'Identificar acciones de mejora según resultados',
      responsible: 'Docentes',
      goal: 'Anexo 4',
    },
    {
      activity: 'Aprobar con acto resolutivo el Plan de Mejora',
      responsible: 'Decano',
      goal: 'Resolución',
    },
    {
      activity: 'Implementar el plan de mejora',
      responsible: 'Docentes',
      goal: null,
    },
    {
      activity: 'Seguimiento de la ejecución',
      responsible: 'Presidente',
      goal: null,
    },
    {
      activity: 'Informes de las acciones implementadas',
      responsible: 'Docentes',
      goal: 'Informe',
    },
  ],
  P623: [
    {
      activity: 'Elaborar y aprobar el cronograma incluyendo las encuestas de medición indirecta',
      responsible: 'Presidente',
      goal: 'Anexo 1, Anexo 10',
    },
    {
      activity: 'Validar el listado de graduados y empleadores',
      responsible: 'Presidente',
      goal: 'Anexo 3',
    },
    {
      activity: 'Revisar la pertinencia de las encuestas',
      responsible: 'Presidente',
      goal: 'Anexo 10',
    },
    {
      activity: 'Medir los AG con los Empleadores',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Medir los AG con los Graduados',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Consolidar y analizar aportes',
      responsible: 'Presidente',
      goal: 'Anexo 2',
    },
    {
      activity: 'Identificar acciones de mejora',
      responsible: 'Presidente',
      goal: 'Anexo 4',
    },
    {
      activity: 'Aprobar con acto resolutivo el Plan de Mejora',
      responsible: 'Decano',
      goal: 'Resolución',
    },
    {
      activity: 'Implementar el Plan de Mejora',
      responsible: 'Docentes',
      goal: null,
    },
    {
      activity: 'Seguimiento de la ejecución',
      responsible: 'Presidente',
      goal: null,
    },
    {
      activity: 'Informes de las acciones implementadas',
      responsible: 'Docentes',
      goal: 'Informe',
    },
  ],
};

export function buildProposedActivities(
  processType: ProcessType,
): readonly ProposedScheduleActivityDraft[] {
  return PROCEDURE_STEPS[processType].map((step, index) => ({
    number: index + 1,
    activity: step.activity,
    responsible: step.responsible,
    goal: step.goal,
  }));
}
