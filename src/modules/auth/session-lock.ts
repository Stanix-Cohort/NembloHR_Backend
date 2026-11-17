import type { Prisma } from "../../generated/prisma/client.js";

/**
 * Acquires a transaction-level advisory lock for a user.
 *
 * Authentication operations for the same user are
 * serialised until their database transaction completes.
 */
export async function acquireUserSessionLock(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.$queryRaw`
    WITH lock_acquired AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(
        hashtextextended(
          ${`nemblo-auth-user:${userId}`},
          0
        )
      )
    )
    SELECT 1 AS locked
    FROM lock_acquired
  `;
}
