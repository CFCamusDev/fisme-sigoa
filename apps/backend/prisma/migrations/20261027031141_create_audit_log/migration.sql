-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'STATE_CHANGE', 'VOID', 'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'ROLE_CHANGE', 'PERMISSION_CHANGE', 'PARAMETER_CHANGE', 'DOWNLOAD', 'PUBLIC_RESPONSE');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "sequence" BIGINT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "actor" TEXT NOT NULL,
    "ip" TEXT,
    "requestId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "previousHash" TEXT,
    "hash" TEXT NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_sequence_key" ON "audit_logs"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_hash_key" ON "audit_logs"("hash");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs"("actor");

-- CreateIndex
CREATE INDEX "audit_logs_occurredAt_idx" ON "audit_logs"("occurredAt");
