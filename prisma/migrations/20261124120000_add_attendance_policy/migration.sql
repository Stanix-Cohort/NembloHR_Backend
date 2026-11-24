-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "earlyArrival" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "earlyDeparture" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "policyClosingTime" TEXT,
ADD COLUMN     "policyGracePeriodMinutes" INTEGER,
ADD COLUMN     "policyResumptionTime" TEXT,
ADD COLUMN     "policyTimezone" TEXT,
ADD COLUMN     "policyWorkingDays" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "attendance_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "resumptionTime" TEXT,
    "closingTime" TEXT,
    "gracePeriodMinutes" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "workingDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_settings_pkey" PRIMARY KEY ("id")
);
