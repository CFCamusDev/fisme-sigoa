const inFlight = new Map<string, Promise<unknown>>();

/**
 * Punto de entrada único de una operación que no debe repetirse (registrar, editar, publicar, enviar
 * a validación): N llamadores simultáneos con la misma clave comparten una sola petición (doble
 * clic, Enter repetido, efectos duplicados bajo `<StrictMode>`). La marca se libera al terminar, con
 * éxito o con error, para permitir el reintento manual.
 */
export function shareInFlight<T>(key: string, start: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }
  const promise = start().finally(() => {
    if (inFlight.get(key) === promise) {
      inFlight.delete(key);
    }
  });
  inFlight.set(key, promise);
  return promise;
}

/**
 * Drena y devuelve las claves de operaciones `shareInFlight` que quedaron pendientes al cerrar una
 * prueba. Usado por el `afterEach` global de Vitest para detectar en local cualquier petición en
 * vuelo no esperada antes de que contamine la siguiente prueba en CI.
 */
export function drainInFlightForTests(): string[] {
  const leakedKeys = [...inFlight.keys()];
  inFlight.clear();
  return leakedKeys;
}
