import { ANNEX_TEMPLATES_1_TO_4 } from './annexes-1-4.js';
import { ANNEX_TEMPLATES_5_TO_8 } from './annexes-5-8.js';
import { ANNEX_TEMPLATES_9_TO_11 } from './annexes-9-11.js';
import { INSTRUMENT_TEMPLATES } from './instruments.js';
import { MINUTES_AND_SURVEY_TEMPLATES } from './minutes-and-surveys.js';
import type { TemplateSeedDefinition } from './template-seed-types.js';

/** Catálogo cerrado de plantillas oficiales: cada una se siembra como versión 1 Publicada. */
export const OFFICIAL_TEMPLATES: readonly TemplateSeedDefinition[] = [
  ...ANNEX_TEMPLATES_1_TO_4,
  ...ANNEX_TEMPLATES_5_TO_8,
  ...ANNEX_TEMPLATES_9_TO_11,
  ...MINUTES_AND_SURVEY_TEMPLATES,
  ...INSTRUMENT_TEMPLATES,
];
