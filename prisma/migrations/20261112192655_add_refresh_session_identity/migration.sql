-- Add sessionId as nullable temporarily.
ALTER TABLE "refresh_sessions"
ADD COLUMN "sessionId" TEXT;

-- Backfill existing records with unique session identifiers.
UPDATE "refresh_sessions"
SET "sessionId" = gen_random_uuid()::text
WHERE "sessionId" IS NULL;

-- Enforce NOT NULL after backfilling.
ALTER TABLE "refresh_sessions"
ALTER COLUMN "sessionId" SET NOT NULL;

-- Create the session-family lookup index.
CREATE INDEX "refresh_sessions_sessionId_revokedAt_idx"
ON "refresh_sessions"("sessionId", "revokedAt");