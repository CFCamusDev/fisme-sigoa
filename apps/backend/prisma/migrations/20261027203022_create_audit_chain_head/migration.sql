-- CreateTable
CREATE TABLE "audit_chain_heads" (
    "id" TEXT NOT NULL,
    "sequence" BIGINT NOT NULL,
    "hash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_chain_heads_pkey" PRIMARY KEY ("id")
);

-- Revocar DELETE y TRUNCATE sobre audit_chain_heads al rol sigoa_app (RS-040, RNF-014)
REVOKE DELETE, TRUNCATE ON TABLE "audit_chain_heads" FROM sigoa_app;

-- Reversible / Down migration:
-- DROP TABLE IF EXISTS "audit_chain_heads";
