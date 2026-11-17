-- CreateTable
CREATE TABLE "session_executions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "processExecutionId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_executions_processExecutionId_idx" ON "session_executions"("processExecutionId");

-- CreateIndex
CREATE UNIQUE INDEX "session_executions_sessionId_processExecutionId_key" ON "session_executions"("sessionId", "processExecutionId");

-- AddForeignKey
ALTER TABLE "session_executions" ADD CONSTRAINT "session_executions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_executions" ADD CONSTRAINT "session_executions_processExecutionId_fkey" FOREIGN KEY ("processExecutionId") REFERENCES "process_executions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
