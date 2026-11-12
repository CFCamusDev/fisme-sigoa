import { PERMISSION_CODE_PATTERN } from '@sigoa/shared';

export interface PermissionActionDefinition {
  readonly action: string;
  readonly description: string;
}

export interface PermissionGroupDefinition {
  readonly resource: string;
  readonly module: string;
  readonly actions: readonly PermissionActionDefinition[];
}

export const PERMISSION_GROUPS: readonly PermissionGroupDefinition[] = [
  // M01 Seguridad y Acceso
  {
    resource: 'usuario',
    module: 'M01 Seguridad',
    actions: [
      { action: 'ver', description: 'Permite visualizar y listar los usuarios del sistema' },
      { action: 'crear', description: 'Permite registrar nuevos usuarios en el sistema' },
      { action: 'editar', description: 'Permite actualizar datos y estados de usuarios' },
    ],
  },
  {
    resource: 'rol',
    module: 'M01 Seguridad',
    actions: [
      { action: 'ver', description: 'Permite visualizar y listar los roles del sistema' },
      {
        action: 'editar',
        description: 'Permite modificar nombres, estados y permisos de los roles',
      },
    ],
  },
  {
    resource: 'permiso',
    module: 'M01 Seguridad',
    actions: [
      { action: 'asignar', description: 'Permite asignar permisos específicos a roles o usuarios' },
    ],
  },

  // M02 Configuración y Parámetros
  {
    resource: 'parametro',
    module: 'M02 Configuración',
    actions: [
      {
        action: 'ver',
        description: 'Permite consultar los parámetros de configuración institucional',
      },
      { action: 'editar', description: 'Permite modificar los valores de parámetros del sistema' },
    ],
  },

  // M03 Catálogo de Objetivos y Atributos
  {
    resource: 'catalogo',
    module: 'M03 Catálogo',
    actions: [
      {
        action: 'ver',
        description:
          'Permite consultar las versiones de objetivos educacionales y atributos del graduado',
      },
      {
        action: 'editar',
        description: 'Permite crear y modificar versiones del catálogo institucional',
      },
    ],
  },

  // M04 Plantillas de Documentos
  {
    resource: 'plantilla',
    module: 'M04 Plantillas',
    actions: [
      { action: 'ver', description: 'Permite visualizar las plantillas de documentos y encuestas' },
      { action: 'editar', description: 'Permite diseñar y modificar plantillas del sistema' },
      { action: 'publicar', description: 'Permite publicar versiones vigentes de plantillas' },
    ],
  },

  // M05 Grupos de Interés y Comités
  {
    resource: 'constituyente',
    module: 'M05 Grupos de Interés',
    actions: [
      {
        action: 'ver',
        description: 'Permite consultar las listas y registros de grupos de interés',
      },
      {
        action: 'editar',
        description: 'Permite actualizar datos de los constituyentes del programa',
      },
      { action: 'importar', description: 'Permite importar masivamente listas de constituyentes' },
    ],
  },
  {
    resource: 'comite',
    module: 'M05 Grupos de Interés',
    actions: [
      { action: 'ver', description: 'Permite consultar la conformación del Comité de Calidad' },
      {
        action: 'editar',
        description: 'Permite gestionar los miembros y roles del Comité de Calidad',
      },
    ],
  },

  // M06 Gestión de Procesos y Cronograma
  {
    resource: 'ejecucion',
    module: 'M06 Procesos',
    actions: [
      {
        action: 'ver',
        description: 'Permite consultar las ejecuciones de procesos de medición y revisión',
      },
      { action: 'crear', description: 'Permite aperturar una nueva ejecución de proceso' },
      {
        action: 'avanzar',
        description: 'Permite registrar avances en las etapas de una ejecución',
      },
      { action: 'cerrar', description: 'Permite formalizar el cierre de una ejecución de proceso' },
      {
        action: 'anular',
        description: 'Permite anular una ejecución de proceso con justificación',
      },
    ],
  },
  {
    resource: 'cronograma',
    module: 'M06 Procesos',
    actions: [
      {
        action: 'ver',
        description: 'Permite consultar el cronograma de actividades de un proceso',
      },
      {
        action: 'editar',
        description: 'Permite programar y actualizar actividades en el cronograma',
      },
    ],
  },

  // M07 Sesiones y Encuestas
  {
    resource: 'sesion',
    module: 'M07 Sesiones y Encuestas',
    actions: [
      { action: 'ver', description: 'Permite consultar sesiones de trabajo y actas de asistencia' },
      {
        action: 'editar',
        description: 'Permite convocar, registrar y actualizar sesiones del comité',
      },
    ],
  },
  {
    resource: 'encuesta',
    module: 'M07 Sesiones y Encuestas',
    actions: [
      {
        action: 'ver',
        description: 'Permite consultar las encuestas aplicadas a los constituyentes',
      },
      {
        action: 'editar',
        description: 'Permite estructurar preguntas y secciones de las encuestas',
      },
      {
        action: 'publicar',
        description: 'Permite publicar encuestas para recolección de respuestas',
      },
      {
        action: 'cerrar',
        description: 'Permite finalizar la recolección de respuestas de una encuesta',
      },
    ],
  },
  {
    resource: 'invitacion',
    module: 'M07 Sesiones y Encuestas',
    actions: [
      { action: 'enviar', description: 'Permite emitir invitaciones personalizadas a encuestas' },
      {
        action: 'reenviar',
        description: 'Permite reenviar enlaces de acceso a encuestas pendientes',
      },
      { action: 'revocar', description: 'Permite invalidar invitaciones emitidas a encuestas' },
    ],
  },

  // M08 Actas y Resoluciones
  {
    resource: 'acta',
    module: 'M08 Actas y Resoluciones',
    actions: [
      { action: 'ver', description: 'Permite consultar actas de sesiones y acuerdos del comité' },
      { action: 'editar', description: 'Permite redactar y actualizar el contenido de actas' },
      {
        action: 'enviar_revision',
        description: 'Permite remitir actas a revisión por los participantes',
      },
      { action: 'firmar', description: 'Permite firmar digitalmente las actas aprobadas' },
      { action: 'anular', description: 'Permite anular actas con el debido sustento formal' },
    ],
  },
  {
    resource: 'resolucion',
    module: 'M08 Actas y Resoluciones',
    actions: [
      { action: 'ver', description: 'Permite consultar resoluciones de consejo o decanato' },
      { action: 'registrar', description: 'Permite ingresar resoluciones oficiales al sistema' },
      {
        action: 'aprobar',
        description: 'Permite validar y dar conformidad a resoluciones registradas',
      },
    ],
  },

  // M09 Plan de Estudios y Cursos
  {
    resource: 'academico',
    module: 'M09 Gestión Académica',
    actions: [
      {
        action: 'ver',
        description: 'Permite consultar información académica de planes y asignaturas',
      },
      { action: 'editar', description: 'Permite gestionar planes de estudio, cursos y docentes' },
      {
        action: 'importar',
        description: 'Permite cargar datos académicos desde archivos estructurados',
      },
    ],
  },

  // M10 Medición Directa y Evaluación
  {
    resource: 'matriz',
    module: 'M10 Medición Directa',
    actions: [
      {
        action: 'ver',
        description: 'Permite consultar la matriz de alineamiento curricular de competencias',
      },
      {
        action: 'editar',
        description: 'Permite configurar los niveles de aporte de asignaturas a atributos',
      },
    ],
  },
  {
    resource: 'plan_assessment',
    module: 'M10 Medición Directa',
    actions: [
      {
        action: 'ver',
        description: 'Permite consultar los planes de evaluación y assessment semestral',
      },
      { action: 'editar', description: 'Permite planificar las mediciones y metas de evaluación' },
      {
        action: 'aprobar',
        description: 'Permite aprobar el plan de assessment para el período académico',
      },
    ],
  },
  {
    resource: 'instrumento',
    module: 'M10 Medición Directa',
    actions: [
      { action: 'ver', description: 'Permite consultar instrumentos de evaluación y rúbricas' },
      {
        action: 'editar',
        description: 'Permite diseñar criterios y descriptores en los instrumentos',
      },
      {
        action: 'enviar',
        description: 'Permite remitir instrumentos completados para su validación',
      },
      { action: 'aprobar', description: 'Permite aprobar los instrumentos de evaluación docente' },
      {
        action: 'observar',
        description: 'Permite registrar observaciones y devoluciones de instrumentos',
      },
    ],
  },
  {
    resource: 'medicion',
    module: 'M10 Medición Directa',
    actions: [
      {
        action: 'ver',
        description: 'Permite consultar registros y evidencias de medición directa',
      },
      {
        action: 'registrar',
        description: 'Permite asentar calificaciones y valoraciones de los estudiantes',
      },
      {
        action: 'enviar',
        description: 'Permite remitir mediciones completadas al comité de calidad',
      },
      {
        action: 'revisar',
        description: 'Permite revisar y dar conformidad a mediciones registradas',
      },
      {
        action: 'devolver',
        description: 'Permite devolver mediciones con observaciones para subsanación',
      },
    ],
  },

  // M11 Resultados y Reportes de Logro
  {
    resource: 'resultado',
    module: 'M11 Resultados',
    actions: [
      {
        action: 'ver',
        description: 'Permite consultar los consolidados de logro de atributos y objetivos',
      },
      {
        action: 'recalcular',
        description: 'Permite recomputar indicadores y niveles de logro consolidados',
      },
    ],
  },

  // M12 Mejora Continua
  {
    resource: 'plan_mejora',
    module: 'M12 Mejora Continua',
    actions: [
      {
        action: 'ver',
        description: 'Permite consultar los planes de mejora continua institucional',
      },
      { action: 'editar', description: 'Permite formular y modificar planes de mejora continua' },
    ],
  },
  {
    resource: 'accion_mejora',
    module: 'M12 Mejora Continua',
    actions: [
      { action: 'ver', description: 'Permite consultar las acciones de mejora asignadas' },
      {
        action: 'editar',
        description: 'Permite definir actividades, responsables y metas de mejora',
      },
      {
        action: 'avanzar',
        description: 'Permite reportar avances y evidencias de cumplimiento de acciones',
      },
    ],
  },

  // M13 Reportes, Evidencias y Auditoría
  {
    resource: 'reporte',
    module: 'M13 Reportes y Auditoría',
    actions: [
      { action: 'ver', description: 'Permite visualizar paneles analíticos y reportes de gestión' },
    ],
  },
  {
    resource: 'documento',
    module: 'M13 Reportes y Auditoría',
    actions: [
      {
        action: 'descargar',
        description: 'Permite descargar informes oficiales y anexos generados',
      },
    ],
  },
  {
    resource: 'auditoria',
    module: 'M13 Reportes y Auditoría',
    actions: [
      {
        action: 'ver',
        description: 'Permite consultar la bitácora inmutable de eventos del sistema',
      },
    ],
  },
  {
    resource: 'backup',
    module: 'M13 Reportes y Auditoría',
    actions: [
      {
        action: 'ejecutar',
        description: 'Permite iniciar copias de seguridad de la base de datos',
      },
      {
        action: 'descargar',
        description: 'Permite descargar respaldos autorizados de la información',
      },
    ],
  },
] as const;

export interface PermissionDefinition {
  readonly code: string;
  readonly description: string;
  readonly module: string;
}

export const CATALOG_PERMISSIONS: readonly PermissionDefinition[] = PERMISSION_GROUPS.flatMap(
  (group) =>
    group.actions.map((act) => ({
      code: `${group.resource}.${act.action}`,
      description: act.description,
      module: group.module,
    })),
);

export const PERMISSION_CODES = CATALOG_PERMISSIONS.map((p) => p.code) as unknown as readonly [
  (typeof CATALOG_PERMISSIONS)[number]['code'],
  ...(typeof CATALOG_PERMISSIONS)[number]['code'][],
];

export type PermissionCode = (typeof CATALOG_PERMISSIONS)[number]['code'];

export function isValidPermissionCodeFormat(code: string): boolean {
  return PERMISSION_CODE_PATTERN.test(code);
}

const PERMISSIONS_BY_CODE = new Map<string, PermissionDefinition>(
  CATALOG_PERMISSIONS.map((p) => [p.code, p]),
);

export function getPermissionDefinition(code: string): PermissionDefinition | undefined {
  return PERMISSIONS_BY_CODE.get(code);
}

export function isPermissionCode(code: string): code is PermissionCode {
  return PERMISSIONS_BY_CODE.has(code);
}
