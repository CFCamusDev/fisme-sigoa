import { SCALE_CODE_PATTERN, SCALE_NAME_MAX_LENGTH } from '@sigoa/shared';
import type { ResponseScaleDto } from '@sigoa/shared';

const SCALE_TYPE_LABELS: Record<ResponseScaleDto['type'], string> = {
  LIKERT: 'Likert',
  NUMERIC: 'Numérica',
  EVIDENCE: 'Evidencia',
};

/** Tipo de escala en español para la interfaz. */
export function getScaleTypeLabel(type: ResponseScaleDto['type']): string {
  return SCALE_TYPE_LABELS[type];
}

const CODE_MAX_LENGTH = 40;
const CODE_SUFFIX = '_COPIA';
const NAME_SUFFIX = ' (copia)';

/** Código y nombre sugeridos al duplicar, recortados a los máximos que acepta el servidor (D36). */
export function suggestDuplicate(scale: Pick<ResponseScaleDto, 'code' | 'name'>): {
  code: string;
  name: string;
} {
  const code = `${scale.code.slice(0, CODE_MAX_LENGTH - CODE_SUFFIX.length)}${CODE_SUFFIX}`;
  const name = `${scale.name.slice(0, SCALE_NAME_MAX_LENGTH - NAME_SUFFIX.length)}${NAME_SUFFIX}`;
  return {
    code: SCALE_CODE_PATTERN.test(code) ? code : scale.code.slice(0, CODE_MAX_LENGTH),
    name,
  };
}
