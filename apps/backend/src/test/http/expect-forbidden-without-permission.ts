import type { Express } from 'express';
import request from 'supertest';
import { expect } from 'vitest';
import { apiErrorResponseSchema } from '@sigoa/shared';
import type { PrismaClient } from '../../shared/prisma/generated/client.js';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface ExpectForbiddenWithoutPermissionParams {
  readonly app: Express;
  readonly prisma: PrismaClient;
  readonly method: HttpMethod;
  readonly path: string;
  readonly authHeader: string;
  readonly actorId: string;
  readonly expectedPermission: string;
  readonly body?: Record<string, unknown>;
}

/**
 * Helper de integración que invoca un endpoint protegido con un actor sin el permiso requerido,
 * verifica que responde HTTP 403 con contrato ApiError ('FORBIDDEN'), que no filtra el código
 * del permiso en el cuerpo de respuesta, y que escribe exactamente un nuevo registro ACCESS_DENIED
 * en AuditLog atribuido al actor (RF-008, RNF-009, AGENTS §6).
 */
export async function expectForbiddenWithoutPermission(
  params: ExpectForbiddenWithoutPermissionParams,
): Promise<void> {
  const beforeCount = await params.prisma.auditLog.count({
    where: {
      actor: params.actorId,
      action: 'ACCESS_DENIED',
      entityId: params.expectedPermission,
    },
  });

  let req = request(params.app)[params.method](params.path).set('Authorization', params.authHeader);
  if (params.body !== undefined) {
    req = req.send(params.body);
  }

  const response = await req;

  expect(response.status, `${params.method.toUpperCase()} ${params.path} should return 403`).toBe(
    403,
  );
  const parsedError = apiErrorResponseSchema.safeParse(response.body);
  expect(parsedError.success).toBe(true);
  if (parsedError.success) {
    expect(parsedError.data.error.code).toBe('FORBIDDEN');
    expect(parsedError.data.error.message).toBe('No tienes permiso para realizar esta acción.');
  }
  expect(JSON.stringify(response.body)).not.toContain(params.expectedPermission);

  const afterLogs = await params.prisma.auditLog.findMany({
    where: {
      actor: params.actorId,
      action: 'ACCESS_DENIED',
      entityId: params.expectedPermission,
    },
    orderBy: { sequence: 'desc' },
  });

  expect(afterLogs.length).toBe(beforeCount + 1);
  const latest = afterLogs[0]!;
  expect(latest.entity).toBe('Permission');
  expect(latest.after).toMatchObject({
    reason: 'MISSING_PERMISSION',
    method: params.method.toUpperCase(),
  });
}
