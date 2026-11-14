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
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}
