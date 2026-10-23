import { createApp } from './app.js';

const PORT = Number(process.env['PORT']) || 3000;
const app = createApp();

export const server = app.listen(PORT, () => {
  // Punto de entrada del servidor backend
});
