/**
 * FISME-SIGOA · Mapa de estados institucionales a tonos visuales y etiquetas (HU-077, T-077-09).
 *
 * Las claves van en inglés (glosario oficial de AGENTS.md §7.1);
 * las etiquetas visibles van 100% en español.
 * Todos los estilos emplean exclusivamente tokens institucionales definidos en index.css.
 */

export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'closed';

/**
 * Clases Tailwind por tono visual basadas en tokens institucionales.
 * Garantizan contraste accesible ≥ 4.5:1.
 */
export const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-idle-soft text-idle border-idle-border',
  info: 'bg-info-soft text-info border-info-border',
  warning: 'bg-warning-soft text-warning border-warning-border',
  success: 'bg-success-soft text-success border-success-border',
  danger: 'bg-danger-soft text-danger border-danger-border',
  closed: 'bg-closed text-white border-closed',
};

/**
 * Clases base para insignias / badges de estado (forma de pastilla con borde y espaciado consistente).
 */
export const BADGE_BASE =
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-meta font-semibold';

export interface StatusDescriptor {
  readonly label: string;
  readonly tone: StatusTone;
  readonly description?: string;
}

/**
 * Mapa exhaustivo de los 29 estados del glosario (AGENTS.md §7.1, incluido IN_VALIDATION de HU-013) más los estados de logro de AG (MET / NOT_MET).
 */
export const STATUS = {
  // Ejecución de proceso (PR-M01.02.01-EPIS-01)
  PLANNED: { label: 'Planificado', tone: 'neutral' },
  IN_PROGRESS: { label: 'En ejecución', tone: 'info' },
  CONSOLIDATING: { label: 'En consolidación', tone: 'info' },
  PENDING_APPROVAL: { label: 'En aprobación', tone: 'warning' },
  CLOSED: { label: 'Cerrado', tone: 'closed' },
  VOIDED: { label: 'Anulado', tone: 'danger' },

  // Actas, evidencias y documentos institucionales
  DRAFT: { label: 'Borrador', tone: 'neutral' },
  IN_REVIEW: { label: 'En revisión', tone: 'warning' },
  SIGNED: { label: 'Firmada', tone: 'success' },
  REGISTERED: { label: 'Registrada', tone: 'info' },
  APPROVED: { label: 'Aprobada', tone: 'success' },
  PUBLISHED: { label: 'Publicada', tone: 'success' },
  OBSOLETE: { label: 'Obsoleta', tone: 'neutral' },

  // Invitaciones y encuestas
  SENT: { label: 'Enviada', tone: 'info' },
  ANSWERED: { label: 'Respondida', tone: 'success' },
  EXPIRED: { label: 'Expirada', tone: 'warning' },
  REVOKED: { label: 'Revocada', tone: 'danger' },

  // Medición por curso y observaciones
  RETURNED: { label: 'Devuelta', tone: 'warning' },
  REVIEWED: { label: 'Revisada', tone: 'success' },
  NOT_EVALUATED: { label: 'No evaluado', tone: 'neutral' },

  // Planes y acciones de mejora
  IDENTIFIED: { label: 'Identificada', tone: 'neutral' },
  IMPLEMENTED: { label: 'Implementada', tone: 'success' },
  EVALUATED: { label: 'Evaluada', tone: 'closed' },

  // Versiones de catálogo, planes y usuarios
  IN_VALIDATION: { label: 'En validación', tone: 'warning' },
  CURRENT: { label: 'Vigente', tone: 'success' },
  HISTORICAL: { label: 'Histórica', tone: 'neutral' },
  PENDING_ACTIVATION: { label: 'Pendiente de activación', tone: 'warning' },
  ACTIVE: { label: 'Activo', tone: 'success' },
  INACTIVE: { label: 'Inactivo', tone: 'neutral' },

  // Logro de Atributos del Graduado frente a meta
  MET: { label: 'Logrado', tone: 'success' },
  NOT_MET: { label: 'No logrado', tone: 'danger' },
} as const satisfies Record<string, StatusDescriptor>;

export type StatusKey = keyof typeof STATUS;

/**
 * Obtiene el descriptor institucional asociado a una clave de estado.
 */
export function getStatusDescriptor(status: StatusKey | string): StatusDescriptor {
  const descriptor = (STATUS as Record<string, StatusDescriptor>)[status];
  if (!descriptor) {
    return {
      label: status,
      tone: 'neutral',
    };
  }
  return descriptor;
}
