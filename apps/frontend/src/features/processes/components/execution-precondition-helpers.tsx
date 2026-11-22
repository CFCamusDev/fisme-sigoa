import { CircleAlert, CircleCheck, CircleX } from 'lucide-react';

export interface ConflictDetail {
  readonly path?: string;
  readonly message: string;
}

export function extractConflictDetails(details: unknown): readonly ConflictDetail[] | undefined {
  if (!Array.isArray(details)) {
    return undefined;
  }
  const parsed: ConflictDetail[] = [];
  for (const item of details) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as { message?: unknown }).message === 'string'
    ) {
      const rawPath = (item as { path?: unknown }).path;
      parsed.push({
        ...(typeof rawPath === 'string' ? { path: rawPath } : {}),
        message: (item as { message: string }).message,
      });
    }
  }
  return parsed.length > 0 ? parsed : undefined;
}

export function PreconditionIcon({
  state,
}: {
  readonly state: 'MET' | 'UNMET' | 'NOT_VERIFIABLE';
}) {
  if (state === 'MET') {
    return <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />;
  }
  if (state === 'NOT_VERIFIABLE') {
    return <CircleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />;
  }
  return <CircleX className="size-4 shrink-0 text-danger" aria-hidden="true" />;
}
