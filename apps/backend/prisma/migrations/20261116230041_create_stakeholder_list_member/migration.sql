-- CreateTable
CREATE TABLE "stakeholder_list_members" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "stakeholderId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "institution" TEXT,
    "ruc" TEXT,
    "sector" TEXT,
    "representative" TEXT,
    "activity" TEXT,
    "email" TEXT,
    "mobile" TEXT,
    "position" TEXT,
    "graduationYear" INTEGER,
    "cycle" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stakeholder_list_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stakeholder_list_members_stakeholderId_idx" ON "stakeholder_list_members"("stakeholderId");

-- CreateIndex
CREATE UNIQUE INDEX "stakeholder_list_members_listId_stakeholderId_key" ON "stakeholder_list_members"("listId", "stakeholderId");

-- AddForeignKey
ALTER TABLE "stakeholder_list_members" ADD CONSTRAINT "stakeholder_list_members_listId_fkey" FOREIGN KEY ("listId") REFERENCES "stakeholder_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stakeholder_list_members" ADD CONSTRAINT "stakeholder_list_members_stakeholderId_fkey" FOREIGN KEY ("stakeholderId") REFERENCES "stakeholders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
