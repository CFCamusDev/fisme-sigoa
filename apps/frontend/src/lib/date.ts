const TIME_ZONE = 'America/Lima';
const LOCALE = 'es-PE';
const PLACEHOLDER = '—';
const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export type DateInput = Date | string | null | undefined;

/**
 * Normaliza y valida una entrada de fecha.
 * Para cadenas de solo fecha (YYYY-MM-DD), construye una fecha en UTC sin desplazamiento
 * para evitar el error común de mostrar el día anterior en zonas horarias negativas.
 */
export function parseDateInput(input: DateInput): Date | null {
  if (input === null || input === undefined) {
    return null;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }

    const dateOnlyMatch = trimmed.match(DATE_ONLY_REGEX);
    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const month = Number(dateOnlyMatch[2]);
      const day = Number(dateOnlyMatch[3]);

      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
      }

      // Validar fecha real (ej. evitar 31 de febrero)
      const testDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      if (
        testDate.getUTCFullYear() !== year ||
        testDate.getUTCMonth() !== month - 1 ||
        testDate.getUTCDate() !== day
      ) {
        return null;
      }

      return testDate;
    }

    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return isNaN(input.getTime()) ? null : input;
}

/**
 * Formatea una fecha al estándar institucional peruano: dd/mm/aaaa
 * Utiliza la zona horaria America/Lima.
 */
export function formatDate(input: DateInput): string {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    const dateOnlyMatch = trimmed.match(DATE_ONLY_REGEX);
    if (dateOnlyMatch) {
      const date = parseDateInput(trimmed);
      if (!date) {
        return PLACEHOLDER;
      }
      return `${dateOnlyMatch[3]}/${dateOnlyMatch[2]}/${dateOnlyMatch[1]}`;
    }
  }

  const date = parseDateInput(input);
  if (!date) {
    return PLACEHOLDER;
  }

  const formatter = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const parts = formatter.formatToParts(date);
  const partMap = new Map(parts.map((p) => [p.type, p.value]));
  const day = partMap.get('day');
  const month = partMap.get('month');
  const year = partMap.get('year');

  if (!day || !month || !year) {
    return PLACEHOLDER;
  }

  return `${day}/${month}/${year}`;
}

/**
 * Formatea una fecha y hora al estándar institucional: dd/mm/aaaa HH:mm (formato 24 horas)
 * Utiliza la zona horaria America/Lima.
 */
export function formatDateTime(input: DateInput): string {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    const dateOnlyMatch = trimmed.match(DATE_ONLY_REGEX);
    if (dateOnlyMatch) {
      const date = parseDateInput(trimmed);
      if (!date) {
        return PLACEHOLDER;
      }
      return `${dateOnlyMatch[3]}/${dateOnlyMatch[2]}/${dateOnlyMatch[1]} 00:00`;
    }
  }

  const date = parseDateInput(input);
  if (!date) {
    return PLACEHOLDER;
  }

  const formatter = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap = new Map(parts.map((p) => [p.type, p.value]));
  const day = partMap.get('day');
  const month = partMap.get('month');
  const year = partMap.get('year');
  let hour = partMap.get('hour');
  const minute = partMap.get('minute');

  if (!day || !month || !year || !hour || !minute) {
    return PLACEHOLDER;
  }

  // En algunas implementaciones de Intl hour12: false puede devolver '24' para medianoche
  if (hour === '24') {
    hour = '00';
  }

  return `${day}/${month}/${year} ${hour}:${minute}`;
}
