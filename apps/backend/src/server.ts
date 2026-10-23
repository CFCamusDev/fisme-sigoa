import { createApp } from './app.js';
import { loadEnv } from './config/env.js';

const env = loadEnv();
const app = createApp({ env });

export const server = app.listen(env.PORT, () => {
  // Punto de entrada del servidor backend
});
