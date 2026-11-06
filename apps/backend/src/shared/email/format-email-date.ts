/**
 * Formatea una fecha para plantillas de correo en formato dd/mm/aaaa hh:mm
 * bajo la zona horaria America/Lima (UTC-5) y la configuración regional es-PE (RN-004, RS-016, RS-005).
 */
export function formatEmailDateTime(date: Date): string {
  const formatter = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }
  return `${partMap['day']}/${partMap['month']}/${partMap['year']} ${partMap['hour']}:${partMap['minute']}`;
}
