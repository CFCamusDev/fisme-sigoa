import { ZodError } from 'zod';
import { ApiError } from './api-error';

function isSerializedValidatorJson(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
    return false;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.some(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          ('code' in item || 'path' in item || 'message' in item),
      );
    }
    if (typeof parsed === 'object' && parsed !== null) {
      return (
        'issues' in parsed ||
        'code' in parsed ||
        'path' in parsed ||
        'expected' in parsed ||
        'received' in parsed
      );
    }
  } catch {
    return false;
  }

  return false;
}

function extractReadableMessageFromDetails(details: unknown): string | null {
  if (!Array.isArray(details)) {
    return null;
  }

  for (const item of details) {
    if (
      typeof item === 'object' &&
      item !== null &&
      'message' in item &&
      typeof item.message === 'string'
    ) {
      const candidate = item.message.trim();
      if (candidate.length > 0 && !isSerializedValidatorJson(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function sanitizeText(raw: string, fallback: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return fallback;
  }
  if (isSerializedValidatorJson(trimmed)) {
    return fallback;
  }
  return trimmed;
}

/**
 * Extrae un mapa `{ campo: mensaje }` desde un `ZodError` o desde `ApiError.details`,
 * normalizando el prefijo `body.` que añade el validador del backend.
 */
export function getFieldErrors(error: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!error) {
    return result;
  }

  if (error instanceof ZodError) {
    for (const issue of error.issues) {
      const key = issue.path.map(String).join('.');
      if (key && !(key in result)) {
        result[key] = issue.message;
      }
    }
    return result;
  }

  if (typeof error === 'object' && 'details' in error && Array.isArray(error.details)) {
    for (const detail of error.details) {
      if (
        typeof detail === 'object' &&
        detail !== null &&
        'path' in detail &&
        'message' in detail &&
        typeof detail.path === 'string' &&
        typeof detail.message === 'string'
      ) {
        const normalizedPath = detail.path.startsWith('body.')
          ? detail.path.slice('body.'.length)
          : detail.path;
        if (normalizedPath && !(normalizedPath in result)) {
          result[normalizedPath] = detail.message;
        }
      }
    }
  }

  return result;
}

/**
 * Devuelve un mensaje legible para mostrar al usuario a partir de un error de API o de validación,
 * evitando mostrar JSON serializado de Zod o del validador en la interfaz.
 */
export function readableApiMessage(
  error: unknown,
  fallback = 'Revisa los datos ingresados.',
): string {
  if (typeof error === 'string') {
    return sanitizeText(error, fallback);
  }

  if (!error || typeof error !== 'object') {
    return fallback;
  }

  if (error instanceof ZodError) {
    const first = error.issues[0]?.message;
    return first ? sanitizeText(first, fallback) : fallback;
  }

  const candidate = error as Partial<ApiError> & { details?: unknown; message?: unknown };
  const detailMessage = extractReadableMessageFromDetails(candidate.details);
  if (typeof candidate.message === 'string') {
    const trimmed = candidate.message.trim();
    if (trimmed.length > 0 && !isSerializedValidatorJson(trimmed)) {
      return trimmed;
    }
  }

  if (detailMessage) {
    return detailMessage;
  }

  return fallback;
}
