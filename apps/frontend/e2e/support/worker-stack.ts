import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

/** Plazo para que cada servidor de un worker responda (la compilación del frontend va aparte). */
const STARTUP_TIMEOUT_MS = 90_000;
const IS_WINDOWS = os.type() === 'Windows_NT';

export interface WorkerStack {
  apiUrl: string;
  webUrl: string;
  databaseUrl: string;
  apiPort: number;
  webPort: number;
  stop: () => Promise<void>;
}

/** Puerto libre pedido al sistema operativo (puerto 0). */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => (port ? resolve(port) : reject(new Error('Sin puerto libre.'))));
    });
  });
}

/** Espera a que una URL responda con 2xx; falla con el motivo si se agota el plazo. */
export async function waitForUrl(
  url: string,
  timeoutMs: number,
  isAlive: () => boolean = () => true,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'sin respuesta';
  while (Date.now() < deadline) {
    if (!isAlive()) throw new Error(`El proceso terminó antes de responder en ${url}.`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${url} no respondió en ${timeoutMs} ms (${lastError}).`);
}

interface RunningProcess {
  child: ChildProcess;
  output: () => string;
  exited: () => boolean;
}

function startProcess(command: string, env: NodeJS.ProcessEnv): RunningProcess {
  const child = spawn(command, {
    shell: true,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    detached: !IS_WINDOWS,
  });
  let buffer = '';
  let done = false;
  const append = (chunk: Buffer) => {
    buffer = (buffer + chunk.toString()).slice(-4_000);
  };
  child.stdout?.on('data', append);
  child.stderr?.on('data', append);
  child.on('exit', () => {
    done = true;
  });
  return { child, output: () => buffer, exited: () => done };
}

/** Termina el proceso y todo su árbol (la shell lanza a pnpm y este a tsx o vite). */
function killTree(running: RunningProcess): Promise<void> {
  return new Promise((resolve) => {
    const { child } = running;
    if (running.exited() || child.pid === undefined) {
      resolve();
      return;
    }
    child.once('exit', () => resolve());
    if (IS_WINDOWS) {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }
    setTimeout(resolve, 5_000).unref();
  });
}

function runToCompletion(command: string, env: NodeJS.ProcessEnv): Promise<void> {
  const running = startProcess(command, env);
  return new Promise((resolve, reject) => {
    running.child.on('error', reject);
    running.child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`"${command}" terminó con código ${code}: ${running.output()}`));
    });
  });
}

export interface StartWorkerStackOptions {
  index: number;
  databaseUrl: string;
  runId: string;
}

async function tryStart(options: StartWorkerStackOptions): Promise<WorkerStack> {
  const [apiPort, webPort] = [await getFreePort(), await getFreePort()];
  const apiUrl = `http://localhost:${apiPort}`;
  const webUrl = `http://localhost:${webPort}`;
  const outDir = path.join(os.tmpdir(), `sigoa-e2e-${options.runId}-web-${options.index}`);
  const processes: RunningProcess[] = [];

  const stop = async (): Promise<void> => {
    await Promise.all(processes.map(killTree));
    fs.rmSync(outDir, { recursive: true, force: true });
  };

  try {
    // El frontend fija VITE_API_URL al compilar: cada worker compila su propia salida.
    await runToCompletion(
      `pnpm --filter frontend exec vite build --outDir "${outDir}" --emptyOutDir`,
      { ...process.env, VITE_API_URL: apiUrl },
    );

    const backend = startProcess('pnpm --filter backend exec tsx src/server.ts', {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(apiPort),
      CORS_ORIGIN: webUrl,
      ALLOWED_ORIGINS: webUrl,
      DATABASE_URL: options.databaseUrl,
      HSTS_ENABLED: 'false',
      LOG_LEVEL: 'silent',
      RATE_LIMIT_LOGIN_MAX: '1000',
      RATE_LIMIT_SESSION_MAX: '1000',
      RATE_LIMIT_PUBLIC_MAX: '1000',
    });
    processes.push(backend);

    const preview = startProcess(
      `pnpm --filter frontend exec vite preview --outDir "${outDir}" --port ${webPort} --strictPort`,
      { ...process.env, VITE_API_URL: apiUrl },
    );
    processes.push(preview);

    const withOutput = async (running: RunningProcess, url: string, name: string) => {
      try {
        await waitForUrl(url, STARTUP_TIMEOUT_MS, () => !running.exited());
      } catch (error) {
        throw new Error(
          `${name} del worker ${options.index} no arrancó: ${
            error instanceof Error ? error.message : String(error)
          }\n${running.output()}`,
          { cause: error },
        );
      }
    };
    await Promise.all([
      withOutput(backend, `${apiUrl}/health`, 'El backend'),
      withOutput(preview, webUrl, 'El frontend'),
    ]);
  } catch (error) {
    await stop();
    throw error;
  }

  return { apiUrl, webUrl, databaseUrl: options.databaseUrl, apiPort, webPort, stop };
}

/**
 * Arranca el backend y el frontend de un worker con su base de datos y puertos libres.
 * Reintenta una vez con puertos nuevos si el arranque falla (colisión de puertos).
 */
export async function startWorkerStack(options: StartWorkerStackOptions): Promise<WorkerStack> {
  try {
    return await tryStart(options);
  } catch {
    return await tryStart(options);
  }
}
