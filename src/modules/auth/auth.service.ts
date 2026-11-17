import { randomUUID } from "node:crypto";
import { prisma } from "../../database/prisma.js";
import { authConfig } from "../../config/auth.js";
import { acquireUserSessionLock } from "./session-lock.js";

import { hashPassword, verifyPassword } from "../../utils/password.js";

import { generateAccessToken } from "../../utils/token.js";

import {
  generateRefreshToken,
  hashRefreshToken,
} from "../../utils/refresh-token.js";

import type { LoginInput, ChangePasswordInput } from "./auth.validation.js";

/**
 * Authenticates an existing Admin or Employee.
 *
 * Coordinates login operations with other authentication
 * operations using the shared user-level advisory lock.
 */
export async function login(input: LoginInput) {
  const username = input.username.trim().toLowerCase();

  // Find the account to identify the user-level lock.
  const initialUser = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (!initialUser) {
    return null;
  }

  // Generate a unique identity for this login session.
  const sessionId = randomUUID();

  // Generate authentication tokens.
  const refreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);

  const expiresAt = new Date(
    Date.now() + authConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  );

  // Verify the account and create its session atomically.
  const authenticatedUser = await prisma.$transaction(
    async (tx) => {
      // Coordinate login with other authentication operations.
      await acquireUserSessionLock(tx, initialUser.id);

      // Re-read the account after acquiring the lock.
      const user = await tx.user.findUnique({
        where: { id: initialUser.id },
      });

      if (!user || !user.isActive) {
        return null;
      }

      // Reject accounts currently under temporary lockout.
      const now = new Date();

      if (user.lockedUntil && user.lockedUntil > now) {
        return null;
      }

      // Verify the submitted password against the current hash.
      const passwordIsValid = await verifyPassword(
        input.password,
        user.passwordHash,
      );

      if (!passwordIsValid) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: {
              increment: 1,
            },
          },
        });

        return null;
      }

      // Reset login failure information.
      await tx.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: now,
        },
      });

      // Create the refresh session.
      await tx.refreshSession.create({
        data: {
          userId: user.id,
          sessionId,
          tokenHash,
          expiresAt,
        },
      });

      return {
        id: user.id,
        username: user.username,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      };
    },
    {
      maxWait: 10_000,
      timeout: 10_000,
    },
  );

  if (!authenticatedUser) {
    return null;
  }

  // Generate the access token after successful authentication.
  const accessToken = await generateAccessToken({
    userId: authenticatedUser.id,
    username: authenticatedUser.username,
    role: authenticatedUser.role,
    sessionId,
  });

  return {
    accessToken,
    refreshToken,
    user: authenticatedUser,
  };
}

// Possible outcomes of a password-change operation.
type ChangePasswordResult =
  | {
      success: true;
    }
  | {
      success: false;
      reason:
        | "USER_NOT_FOUND"
        | "INVALID_CURRENT_PASSWORD"
        | "ACCOUNT_UNAVAILABLE";
    };

/**
 * Changes the authenticated user's password.
 *
 * Security measures:
 * 1. Verifies the current password.
 * 2. Hashes the new password using Argon2id.
 * 3. Prevents concurrent password changes from overwriting one another.
 * 4. Clears the temporary-password requirement.
 * 5. Resets failed login attempts and account lockout.
 * 6. Revokes other active refresh sessions.
 * 7. Preserves the current valid refresh session when supplied.
 *
 * All database changes happen within one transaction.
 */

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
  currentRefreshToken?: string,
): Promise<ChangePasswordResult> {
  // Retrieve the authenticated user's current account information.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      passwordHash: true,
      isActive: true,
    },
  });

  if (!user) {
    return {
      success: false,
      reason: "USER_NOT_FOUND",
    };
  }

  if (!user.isActive) {
    return {
      success: false,
      reason: "ACCOUNT_UNAVAILABLE",
    };
  }

  // Verify the supplied current password.
  const currentPasswordIsValid = await verifyPassword(
    input.currentPassword,
    user.passwordHash,
  );

  if (!currentPasswordIsValid) {
    return {
      success: false,
      reason: "INVALID_CURRENT_PASSWORD",
    };
  }

  // Hash the new password before saving it.
  const newPasswordHash = await hashPassword(input.newPassword);

  // Hash the current refresh token if supplied.
  const currentTokenHash = currentRefreshToken
    ? hashRefreshToken(currentRefreshToken)
    : null;

  return prisma.$transaction(
    async (tx): Promise<ChangePasswordResult> => {
      // Coordinate password changes with other authentication operations.
      await acquireUserSessionLock(tx, userId);

      const now = new Date();

      // Update only if the account is still active and its password
      // has not changed since the initial verification.
      const updateResult = await tx.user.updateMany({
        where: {
          id: userId,
          isActive: true,
          passwordHash: user.passwordHash,
        },
        data: {
          passwordHash: newPasswordHash,
          mustChangePassword: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      // Protect against account deactivation or concurrent password changes.
      if (updateResult.count !== 1) {
        return {
          success: false,
          reason: "ACCOUNT_UNAVAILABLE",
        };
      }

      // Find the current valid refresh session, if one was supplied.
      const currentSession = currentTokenHash
        ? await tx.refreshSession.findFirst({
            where: {
              userId,
              tokenHash: currentTokenHash,
              revokedAt: null,
              expiresAt: {
                gt: now,
              },
            },
            select: {
              sessionId: true,
            },
          })
        : null;

      // Revoke every other active session.
      // If no valid current session exists, revoke all sessions.
      await tx.refreshSession.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(currentSession
            ? {
                sessionId: {
                  not: currentSession.sessionId,
                },
              }
            : {}),
        },
        data: {
          revokedAt: now,
        },
      });

      return {
        success: true,
      };
    },
    {
      maxWait: 10_000,
      timeout: 10_000,
    },
  );
}
