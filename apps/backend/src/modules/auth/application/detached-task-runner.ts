export type DetachedTask = () => Promise<void>;

export interface DetachedTaskRunner {
  run(task: DetachedTask): void;
}

export interface DetachedTaskRunnerLogger {
  error(message: string, ...meta: unknown[]): void;
}

/**
 * Ejecutor por defecto que despacha tareas asíncronas sin bloquear el flujo principal
 * y captura de forma segura cualquier error de ejecución para registrarlo sin propagar (D7).
 */
export class DefaultDetachedTaskRunner implements DetachedTaskRunner {
  constructor(private readonly logger?: DetachedTaskRunnerLogger) {}

  run(task: DetachedTask): void {
    Promise.resolve()
      .then(task)
      .catch((error: unknown) => {
        this.logger?.error('Error al ejecutar tarea asíncrona desvinculada', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }
}
