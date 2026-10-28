import type { AuditEvent, AuditLogger, AuditPayload } from './audit-logger.js';

/**
 * Clona de forma segura un payload serializable para evitar mutaciones externas posteriores.
 */
function clonePayload(payload: AuditPayload | undefined): AuditPayload | undefined {
  if (payload === undefined || payload === null) {
    return payload;
  }
  if (typeof payload === 'object') {
    return JSON.parse(JSON.stringify(payload)) as AuditPayload;
  }
  return payload;
}

/**
 * Adaptador en memoria del puerto AuditLogger (RS-043, RNF-016, RNF-026).
 *
 * Útil para pruebas unitarias de casos de uso y módulos que no requieren persistencia
 * real de auditoría en PostgreSQL ni transacciones con Prisma.
 */
export class InMemoryAuditLogger implements AuditLogger {
  private readonly _events: AuditEvent[] = [];

  /**
   * Permite configurar un error para simular fallos de auditoría en pruebas.
   */
  public simulateFailure: Error | null = null;

  /**
   * Lista inmutable de eventos registrados en orden de invocación.
   */
  get events(): readonly AuditEvent[] {
    return [...this._events];
  }

  async log(event: AuditEvent): Promise<void> {
    if (this.simulateFailure) {
      throw this.simulateFailure;
    }

    const defensiveCopy: AuditEvent = {
      ...event,
      before: clonePayload(event.before),
      after: clonePayload(event.after),
    };

    this._events.push(defensiveCopy);
  }

  /**
   * Limpia los eventos acumulados.
   */
  clear(): void {
    this._events.length = 0;
  }
}
