import { fileURLToPath } from 'node:url';
import { loadEnvFileIfPresent } from './config/load-env-file.js';
import { parseEnv } from './config/env.js';
import { createLogger } from './shared/logger/logger.js';
import { createEmailSender } from './shared/email/create-email-sender.js';
import { createFileStorage } from './shared/storage/create-file-storage.js';
import { computeSha256 } from './shared/storage/file-hash.js';

loadEnvFileIfPresent();

export interface SmokeAdaptersOptions {
  email?: string;
  storage?: boolean;
}

export function parseArgs(argv: string[]): SmokeAdaptersOptions {
  const options: SmokeAdaptersOptions = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email' && argv[i + 1]) {
      options.email = argv[i + 1];
      i++;
    } else if (arg === '--storage') {
      options.storage = true;
    }
  }

  return options;
}

export async function runSmokeAdapters(options: SmokeAdaptersOptions): Promise<void> {
  const env = parseEnv(process.env);
  const logger = createLogger(env);

  if (!options.email && !options.storage) {
    console.log('Uso: pnpm smoke:adapters [--email <destinatario>] [--storage]');
    return;
  }

  if (options.email) {
    logger.info({ emailProvider: env.EMAIL_PROVIDER }, 'Ejecutando prueba de humo de correo...');
    const emailSender = createEmailSender(env);
    const result = await emailSender.send({
      to: options.email,
      subject: 'Prueba de conectividad - FISME-SIGOA',
      template: 'connectivity-check',
      variables: { code: 'SMOKE-TEST' },
    });
    logger.info({ messageId: result.messageId }, 'Correo de prueba enviado satisfactoriamente.');
  }

  if (options.storage) {
    logger.info(
      { fileStorageProvider: env.FILE_STORAGE_PROVIDER },
      'Ejecutando prueba de humo de almacenamiento de archivos...',
    );
    const storage = createFileStorage(env);
    const testContent = Buffer.from(
      '%PDF-1.4\nPrueba de humo de adaptador de almacenamiento FISME-SIGOA',
    );
    const localSha256 = computeSha256(testContent);

    const uploaded = await storage.upload({
      content: testContent,
      originalName: 'smoke-test.pdf',
      mimeType: 'application/pdf',
      folder: 'smoke-tests',
    });

    if (uploaded.sha256 !== localSha256) {
      throw new Error(
        `Discrepancia en hash SHA-256. Esperado: ${localSha256}, Obtenido: ${uploaded.sha256}`,
      );
    }

    const downloadUrl = storage.getUrl(uploaded.publicId);
    if (!downloadUrl) {
      throw new Error('No se pudo generar la dirección URL de descarga del archivo.');
    }

    await storage.delete(uploaded.publicId);
    logger.info(
      { publicId: uploaded.publicId, sha256: uploaded.sha256 },
      'Archivo de prueba subido, verificado y eliminado satisfactoriamente.',
    );
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  (process.argv[1] === fileURLToPath(import.meta.url) ||
    process.argv[1].endsWith('smoke-adapters.ts') ||
    process.argv[1].endsWith('smoke-adapters.js'));

if (isDirectExecution) {
  const options = parseArgs(process.argv.slice(2));
  runSmokeAdapters(options).catch((error: unknown) => {
    console.error('Error durante la prueba de humo de adaptadores:', (error as Error).message);
    process.exit(1);
  });
}
