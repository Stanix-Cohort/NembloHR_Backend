import { randomUUID } from "node:crypto";
import { prisma } from "../../database/prisma.js";
import { authConfig } from "../../config/auth.js";
import type { UserRole } from "../../generated/prisma/client.js";
import {
  generateRefreshToken,
  hashRefreshToken,
} from "../../utils/refresh-token.js";
import { acquireUserSessionLock } from "./session-lock.js";

// Allows a short window for concurrent refresh requests.
const REFRESH_TOKEN_REUSE_GRACE_PERIOD_MS = 10 * 1000;

/**
 * Calculates the expiry date for a refresh-token session.
 */
function getRefreshTokenExpiry(): Date {
  return new Date(
    Date.now() + authConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  );
}

/**
 * Creates a new refresh-token session for a user.
 *
 * Only the hashed token is stored in the database.
 */
export async function createRefreshSession(
  userId: string,
  refreshToken: string,
  sessionId: string = randomUUID(),
) {
  return prisma.refreshSession.create({
    data: {
      userId,
      sessionId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: getRefreshTokenExpiry(),
    },
  });
}

/**
 * Rotates an existing refresh-token session.
 *
 * The old session is revoked and a replacement session
 * is created within one database transaction.
 *
 * Returns null if the token is invalid, expired, revoked,
 * or belongs to an inactive user.
 */

type RotateRefreshSessionResult =
  | {
      kind: "success";
      refreshToken: string;
      sessionId: string;
      user: {
        id: string;
        username: string;
        role: UserRole;
        mustChangePassword: boolean;
      };
    }
  | {
      kind: "concurrent";
    }
  | {
      kind: "reuse";
    };

export async function rotateRefreshSession(
  refreshToken: string,
): Promise<RotateRefreshSessionResult | null> {
  const tokenHash = hashRefreshToken(refreshToken);

  return prisma.$transaction(
    async (tx) => {
      // Find the supplied refresh token, including revoked records.
      const initialSession = await tx.refreshSession.findUnique({
        where: { tokenHash },
        select: {
          userId: true,
          sessionId: true,
        },
      });

      if (!initialSession) {
        return null;
      }

      // Serialise authentication operations for this user.
      await acquireUserSessionLock(tx, initialSession.userId);
      // Capture the current time after acquiring the user-level lock.
      const now = new Date();
      // Re-read the token after acquiring the user-level lock.
      const existingSession = await tx.refreshSession.findUnique({
        where: { tokenHash },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              role: true,
              isActive: true,
              mustChangePassword: true,
            },
          },
        },
      });

      if (!existingSession || existingSession.expiresAt <= now) {
        return null;
      }

      // Determine whether this token was previously rotated.
      if (existingSession.revokedAt) {
        if (!existingSession.lastUsedAt) {
          // Logout/password-change revocation is not token reuse.
          return null;
        }

        const elapsedSinceRotation =
          now.getTime() - existingSession.lastUsedAt.getTime();

        if (elapsedSinceRotation <= REFRESH_TOKEN_REUSE_GRACE_PERIOD_MS) {
          // A concurrent or closely repeated request.
          // Do not revoke the family or clear the browser cookie.
          return { kind: "concurrent" };
        }

        // Suspected reuse: revoke every active token in this family.
        await tx.refreshSession.updateMany({
          where: {
            userId: existingSession.userId,
            sessionId: existingSession.sessionId,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
          },
        });

        return { kind: "reuse" };
      }

      // Do not allow inactive accounts to continue refreshing.
      if (!existingSession.user.isActive) {
        await tx.refreshSession.updateMany({
          where: {
            userId: existingSession.userId,
            sessionId: existingSession.sessionId,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
          },
        });

        return null;
      }

      // Atomically revoke the current refresh token.
      const revokedSession = await tx.refreshSession.updateMany({
        where: {
          id: existingSession.id,
          revokedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          revokedAt: now,
          lastUsedAt: now,
        },
      });

      if (revokedSession.count !== 1) {
        return null;
      }

      // Generate the replacement refresh token.
      const newRefreshToken = generateRefreshToken();

      // Preserve the original session family identity.
      await tx.refreshSession.create({
        data: {
          userId: existingSession.userId,
          sessionId: existingSession.sessionId,
          tokenHash: hashRefreshToken(newRefreshToken),
          expiresAt: getRefreshTokenExpiry(),
        },
      });

      return {
        kind: "success",
        refreshToken: newRefreshToken,
        sessionId: existingSession.sessionId,
        user: existingSession.user,
      };
    },
    {
      maxWait: 10_000,
      timeout: 10_000,
    },
  );
}


/**
 * Revokes a refresh-token session during logout.
 *
 * Acquires the user's authentication lock before revoking
 * all active refresh tokens belonging to the session family.
 */
export async function revokeRefreshSession(
  refreshToken: string,
): Promise<number> {
  const tokenHash = hashRefreshToken(refreshToken);

  return prisma.$transaction(
    async (tx) => {
      // Find the user associated with this refresh token.
      const initialSession = await tx.refreshSession.findUnique({
        where: { tokenHash },
        select: {
          userId: true,
        },
      });

      if (!initialSession) {
        return 0;
      }

      // Coordinate logout with other authentication operations.
      await acquireUserSessionLock(tx, initialSession.userId);

      const now = new Date();

      // Re-read the token after acquiring the lock.
      const session = await tx.refreshSession.findUnique({
        where: { tokenHash },
        select: {
          userId: true,
          sessionId: true,
        },
      });

      if (!session) {
        return 0;
      }

      // Revoke every active token in this session family.
      const result = await tx.refreshSession.updateMany({
        where: {
          userId: session.userId,
          sessionId: session.sessionId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      return result.count;
    },
    {
      maxWait: 10_000,
      timeout: 10_000,
    },
  );
}

