import process from 'node:process';

/**
 * Carga de forma segura las variables de entorno desde un archivo .env si está presente.
 * Utiliza la API nativa de Node.js (>= 20.12) `process.loadEnvFile()`.
 * Si el archivo no existe, no arroja error.
 */
export function loadEnvFileIfPresent(filePath?: string): void {
  try {
    if (typeof process.loadEnvFile === 'function') {
      if (filePath) {
        process.loadEnvFile(filePath);
      } else {
        process.loadEnvFile();
      }
    }
  } catch {
    // No hace nada si el archivo no existe o ocurre un error de lectura
  }
}
