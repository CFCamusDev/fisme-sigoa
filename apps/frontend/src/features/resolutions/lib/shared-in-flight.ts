const inFlight = new Map<string, Promise<unknown>>();

/**
 * Punto de entrada único de una operación de registro o aprobación: N llamadores simultáneos con
 * la misma clave comparten una sola petición (doble clic, Enter repetido). La marca se libera al
 * terminar, con éxito o con error, para permitir el reintento manual (copia de la de `catalog`,
 * D12 del tramo 2: aún no hay un tercer consumidor que justifique moverla a `lib/`).
 */
export function shareInFlight<T>(key: string, start: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }
  const promise = start().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}
