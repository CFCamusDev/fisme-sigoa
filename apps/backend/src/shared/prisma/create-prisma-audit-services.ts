import { AuditChainVerifier } from '../audit/audit-chain-verifier.js';
import type { AuditLogger } from '../audit/audit-logger.js';
import { requestContextProvider, type RequestContextProvider } from '../audit/request-context.js';
import { PrismaAuditChainAnchor } from './prisma-audit-chain-anchor.js';
import { PrismaAuditChainReader } from './prisma-audit-chain-reader.js';
import { PrismaAuditLogger } from './prisma-audit-logger.js';
import type { DbProvider } from './prisma-unit-of-work.js';

export interface PrismaAuditServices {
  auditLogger: AuditLogger;
  chainVerifier: AuditChainVerifier;
  chainReader: PrismaAuditChainReader;
  chainAnchor: PrismaAuditChainAnchor;
}

/**
 * Fábrica para instanciar todos los servicios de auditoría conectados a Prisma y PostgreSQL (HU-075 Tramo 2).
 * Garantiza que el registrador y el verificador compartan el ancla de cabeza y el mismo proveedor transaccional.
 */
export function createPrismaAuditServices(
  dbProvider: DbProvider,
  contextProvider: RequestContextProvider = requestContextProvider,
): PrismaAuditServices {
  const chainAnchor = new PrismaAuditChainAnchor(dbProvider);
  const auditLogger = new PrismaAuditLogger(dbProvider, contextProvider, chainAnchor);
  const chainReader = new PrismaAuditChainReader(dbProvider);
  const chainVerifier = new AuditChainVerifier(chainReader, chainAnchor);

  return {
    auditLogger,
    chainAnchor,
    chainReader,
    chainVerifier,
  };
}
