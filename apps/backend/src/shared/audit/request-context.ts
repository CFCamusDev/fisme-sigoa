import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto de auditoría asociado al ciclo de vida de una petición o tarea (RS-041).
 */
export interface RequestAuditContext {
  actor?: string;
  ip?: string;
  requestId: string;
}

/**
 * Puerto proveedor de contexto de auditoría inyectable.
 */
export interface RequestContextProvider {
  get(): RequestAuditContext | undefined;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestAuditContext>();

/**
 * Ejecuta una función síncrona o asíncrona dentro del ámbito de un contexto de petición (RS-041).
 */
export function runWithRequestContext<T>(
  context: RequestAuditContext,
  fn: () => T | Promise<T>,
): Promise<T> {
  return asyncLocalStorage.run(context, async () => {
    return await fn();
  });
}

/**
 * Obtiene el contexto de auditoría de la petición activa, o undefined si se invoca fuera de una petición.
 */
export function getRequestContext(): RequestAuditContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Establece el actor identificado (ej. tras autenticación JWT en HU-001) en el contexto de la petición activa.
 */
export function setRequestActor(actor: string): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.actor = actor;
  }
}

/**
 * Instancia predeterminada de RequestContextProvider conectada a AsyncLocalStorage.
 */
export const requestContextProvider: RequestContextProvider = {
  get: getRequestContext,
};
