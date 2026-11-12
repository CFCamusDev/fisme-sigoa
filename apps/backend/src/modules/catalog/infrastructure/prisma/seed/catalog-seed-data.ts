export interface SeedObjective {
  readonly code: string;
  readonly statement: string;
}

export interface SeedAttribute {
  readonly code: string;
  readonly name: string;
  readonly statement: string;
}

/**
 * Objetivos Educacionales de la versión 1 del catálogo, aprobados por la Resolución de Decanato
 * N°128-2024-UNTRM/FISME (01/08/2024). El texto es institucional y se conserva tal cual.
 * Se embebe en código porque `docs/` no se versiona (D24).
 */
export const SEED_OBJECTIVES: readonly SeedObjective[] = [
  {
    code: 'OEP1',
    statement:
      'Implementar soluciones tecnológicas innovadoras en proyectos de desarrollo sostenible en la gestión empresarial para optimizar sus procesos cuyo objetivo se basa en la mejora continua y la diversidad cultural para asegurar el cumplimiento de objetivos empresariales.',
  },
  {
    code: 'OEP2',
    statement:
      'Gestionar proyectos tecnológicos e innovadores que respondan a los retos e intereses de la sociedad civil y empresarial que permita ampliar su mercado en beneficio de la sociedad en general teniendo en cuenta estándares y normativas.',
  },
  {
    code: 'OEP3',
    statement:
      'Administrar las Tecnologías de Información y Comunicación con ética, utilizando estándares internacionales, para afrontar competitivamente los cambios organizacionales.',
  },
  {
    code: 'OEP4',
    statement:
      'Desarrollar investigación científica con innovación con sentido humanista y ética para afrontar diversos problemas regionales, nacionales e internacionales.',
  },
];

/** Atributos del Graduado de la versión 1 del catálogo (Anexo 9 del procedimiento). */
export const SEED_ATTRIBUTES: readonly SeedAttribute[] = [
  {
    code: 'AG-C01',
    name: 'El Profesional y el Mundo',
    statement:
      'Analiza y evalúa el impacto de las soluciones a problemas complejos de computación en el desarrollo sostenible de la sociedad, considerando aspectos de salud, seguridad, legales y culturales dentro de los contextos locales y globales, y las consiguientes responsabilidades relevantes para la práctica profesional de la computación.',
  },
  {
    code: 'AG-C02',
    name: 'Ética',
    statement:
      'Aplica principios éticos y se compromete con la ética profesional y las normas de la práctica profesional de la computación, se adhiere a las leyes nacionales e internacionales relevantes y demuestra comprensión de la importancia de la diversidad y la inclusión.',
  },
  {
    code: 'AG-C03',
    name: 'Trabajo Individual y en Equipo',
    statement:
      'Se desempeña efectivamente como individuo y como miembro o líder en equipos diversos e inclusivos y en entornos multidisciplinarios, presenciales, remotos y sus combinaciones.',
  },
  {
    code: 'AG-C04',
    name: 'Comunicación',
    statement:
      'Se comunica de forma efectiva en actividades complejas de computación con la comunidad de computación y la sociedad en general, siendo capaz de comprender y redactar informes y documentación de diseño efectivos, y realizar presentaciones efectivas, teniendo en cuenta diferencias culturales, de idioma y de aprendizaje.',
  },
  {
    code: 'AG-C05',
    name: 'Gestión de Proyectos',
    statement:
      'Aplica los principios de gestión en computación, las metodologías apropiadas a su campo y la toma de decisiones económicas considerando eventuales riesgos, como individuo y como miembro o líder de equipo, para gestionar proyectos en entornos multidisciplinarios.',
  },
  {
    code: 'AG-C06',
    name: 'Aprendizaje a lo largo de la vida',
    statement:
      'Reconoce la importancia y está preparado para: i) aprender de forma independiente y continua, ii) adaptarse a tecnologías nuevas y emergentes, y iii) aplicar el pensamiento crítico en el contexto más amplio de los cambios tecnológicos.',
  },
  {
    code: 'AG-C07',
    name: 'Conocimientos de Computación',
    statement:
      'Aplica conocimientos apropiados de matemáticas, ciencias y computación para desarrollar soluciones a problemas complejos de computación.',
  },
  {
    code: 'AG-C08',
    name: 'Análisis de Problemas',
    statement:
      'Identifica, formula, busca información y analiza problemas complejos de computación llegando a conclusiones fundamentadas usando principios de matemáticas, ciencias de la computación y otras disciplinas relevantes, con las consideraciones necesarias para el desarrollo sostenible.',
  },
  {
    code: 'AG-C09',
    name: 'Diseño y Desarrollo de Soluciones',
    statement:
      'Diseña, implementa y evalúa soluciones para problemas complejos de computación y diseña y evalúa sistemas, componentes o procesos para satisfacer necesidades específicas con consideraciones holísticas para el desarrollo sostenible.',
  },
  {
    code: 'AG-C10',
    name: 'Indagación',
    statement:
      'Estudia problemas complejos de computación usando métodos de ciencias de la información para la búsqueda de información de investigaciones previas; análisis, interpretación y síntesis de información para producir conclusiones válidas.',
  },
  {
    code: 'AG-C11',
    name: 'Uso de Herramientas',
    statement:
      'Crea, selecciona, adapta y aplica técnicas, recursos y herramientas modernas de computación en la resolución de problemas complejos de computación; reconociendo las limitaciones de las mismas.',
  },
  {
    code: 'AG-C12',
    name: 'Entorno de Sistemas de Información',
    statement:
      'Aplica la teoría de la ciencia de la computación y los fundamentos de desarrollo de software para producir soluciones basadas en computadora.',
  },
];
