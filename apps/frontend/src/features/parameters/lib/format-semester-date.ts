const dateFormatter = new Intl.DateTimeFormat('es-PE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * Formatea una fecha de semestre YYYY-MM-DD a formato dd/mm/aaaa (es-PE)
 * fijando la zona horaria en UTC para evitar desplazamientos de fecha (AGENTS §4.3, D2, D5).
 */
export function formatSemesterDate(dateString: string): string {
  if (!dateString) {
    return '';
  }

  // Si ya viene en formato ISO con fecha YYYY-MM-DD
  const cleanDate = dateString.slice(0, 10);
  const utcDate = new Date(`${cleanDate}T00:00:00.000Z`);

  if (Number.isNaN(utcDate.getTime())) {
    return dateString;
  }

  return dateFormatter.format(utcDate);
}
