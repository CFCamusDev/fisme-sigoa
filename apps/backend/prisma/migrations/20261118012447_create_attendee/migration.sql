-- CreateTable
CREATE TABLE "attendees" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "listMemberId" TEXT NOT NULL,
    "position" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendees_listMemberId_idx" ON "attendees"("listMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "attendees_sessionId_listMemberId_key" ON "attendees"("sessionId", "listMemberId");

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_listMemberId_fkey" FOREIGN KEY ("listMemberId") REFERENCES "stakeholder_list_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
