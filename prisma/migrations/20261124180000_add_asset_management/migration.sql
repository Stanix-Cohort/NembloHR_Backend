-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'UNDER_REPAIR', 'LOST', 'RETIRED');

-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED');

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "serialNumber" TEXT,
    "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "description" TEXT,
    "imageUrl" TEXT,
    "imagePublicId" TEXT,
    "fileUrl" TEXT,
    "filePublicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_assignments" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "assignedById" TEXT NOT NULL,
    "returnedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_feedback" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "condition" "AssetCondition" NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assets_assetId_key" ON "assets"("assetId");

-- CreateIndex
CREATE INDEX "assets_status_idx" ON "assets"("status");

-- CreateIndex
CREATE INDEX "assets_type_idx" ON "assets"("type");

-- CreateIndex
CREATE INDEX "asset_assignments_assetId_idx" ON "asset_assignments"("assetId");

-- CreateIndex
CREATE INDEX "asset_assignments_employeeId_idx" ON "asset_assignments"("employeeId");

-- CreateIndex
CREATE INDEX "asset_assignments_assignedAt_idx" ON "asset_assignments"("assignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "asset_assignments_id_assetId_employeeId_key" ON "asset_assignments"("id", "assetId", "employeeId");

-- CreateIndex
CREATE INDEX "asset_feedback_assetId_createdAt_idx" ON "asset_feedback"("assetId", "createdAt");

-- CreateIndex
CREATE INDEX "asset_feedback_assignmentId_idx" ON "asset_feedback"("assignmentId");

-- CreateIndex
CREATE INDEX "asset_feedback_employeeId_idx" ON "asset_feedback"("employeeId");

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_feedback" ADD CONSTRAINT "asset_feedback_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_feedback" ADD CONSTRAINT "asset_feedback_assignmentId_assetId_employeeId_fkey" FOREIGN KEY ("assignmentId", "assetId", "employeeId") REFERENCES "asset_assignments"("id", "assetId", "employeeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_feedback" ADD CONSTRAINT "asset_feedback_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ensure an asset can have only one active assignment at a time
CREATE UNIQUE INDEX "asset_assignments_one_active_per_asset"
ON "asset_assignments" ("assetId")
WHERE "returnedAt" IS NULL;