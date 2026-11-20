-- CreateEnum
CREATE TYPE "ScheduleActivityStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "schedule_activities" (
    "id" TEXT NOT NULL,
    "processExecutionId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "activity" TEXT NOT NULL,
    "responsible" TEXT NOT NULL,
    "goal" TEXT,
    "indicator" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "status" "ScheduleActivityStatus" NOT NULL DEFAULT 'PENDING',
    "actualEndDate" DATE,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_activities_pkey" PRIMARY KEY ("id")
);

-- CreateDeferrableUniqueConstraint (permite renumerar en una sola transaccion)
ALTER TABLE "schedule_activities" ADD CONSTRAINT "schedule_activities_processExecutionId_number_key" UNIQUE ("processExecutionId", "number") DEFERRABLE INITIALLY DEFERRED;

-- AddCheckConstraints
ALTER TABLE "schedule_activities" ADD CONSTRAINT "schedule_activities_number_check" CHECK ("number" >= 1);
ALTER TABLE "schedule_activities" ADD CONSTRAINT "schedule_activities_date_range_check" CHECK ("endDate" IS NULL OR "startDate" IS NULL OR "startDate" <= "endDate");
ALTER TABLE "schedule_activities" ADD CONSTRAINT "schedule_activities_completed_actual_end_date_check" CHECK (("status" = 'COMPLETED') = ("actualEndDate" IS NOT NULL));
ALTER TABLE "schedule_activities" ADD CONSTRAINT "schedule_activities_activity_length_check" CHECK (char_length(btrim("activity")) >= 1 AND char_length("activity") <= 300);
ALTER TABLE "schedule_activities" ADD CONSTRAINT "schedule_activities_responsible_length_check" CHECK (char_length(btrim("responsible")) >= 1 AND char_length("responsible") <= 150);
ALTER TABLE "schedule_activities" ADD CONSTRAINT "schedule_activities_goal_length_check" CHECK ("goal" IS NULL OR char_length("goal") <= 300);
ALTER TABLE "schedule_activities" ADD CONSTRAINT "schedule_activities_indicator_length_check" CHECK ("indicator" IS NULL OR char_length("indicator") <= 300);

-- AddForeignKey
ALTER TABLE "schedule_activities" ADD CONSTRAINT "schedule_activities_processExecutionId_fkey" FOREIGN KEY ("processExecutionId") REFERENCES "process_executions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
