import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { loadEnvFileIfPresent } from './config/load-env-file.js';

// Carga .env si está presente en el entorno local (desarrollo)
loadEnvFileIfPresent();

const env = loadEnv();
const app = createApp({ env });

export const server = app.listen(env.PORT, () => {
  // Punto de entrada del servidor backend
});
