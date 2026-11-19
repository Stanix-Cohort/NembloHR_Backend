
-- Add normalizedName as nullable initially so existing records
-- can be populated before enforcing NOT NULL.
ALTER TABLE "departments"
ADD COLUMN "normalizedName" TEXT;

-- Add department activation status.
ALTER TABLE "departments"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Populate normalizedName for any existing departments.
-- Trim outer whitespace, collapse repeated spaces, and lowercase.
UPDATE "departments"
SET "normalizedName" = LOWER(
    REGEXP_REPLACE(TRIM("name"), '\s+', ' ', 'g')
);

-- Enforce required normalized names.
ALTER TABLE "departments"
ALTER COLUMN "normalizedName" SET NOT NULL;

-- Replace the old unique constraint on the display name.
DROP INDEX "departments_name_key";

-- Enforce uniqueness using normalizedName instead.
CREATE UNIQUE INDEX "departments_normalizedName_key"
ON "departments"("normalizedName");
