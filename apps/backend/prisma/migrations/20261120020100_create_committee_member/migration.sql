-- CreateEnum
CREATE TYPE "CommitteeMemberPosition" AS ENUM ('PRESIDENT', 'MEMBER');

-- CreateTable
CREATE TABLE "committee_members" (
    "id" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "position" "CommitteeMemberPosition" NOT NULL,
    "userId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "committee_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "committee_members_userId_idx" ON "committee_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "committee_members_committeeId_userId_key" ON "committee_members"("committeeId", "userId");

-- AddForeignKey
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "quality_committees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
