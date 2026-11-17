import type { Request, Response, NextFunction } from "express";

import { prisma } from "../database/prisma.js";
import { verifyAccessToken } from "../utils/token.js";

/**
 * Authenticates incoming requests using a JWT access token.
 *
 * 1. Extracts the Bearer token from the Authorization header.
 * 2. Verifies the token's signature and expiration.
 * 3. Retrieves the user's current record from the database.
 * 4. Rejects missing, invalid, or inactive users.
 * 5. Attaches the authenticated user's current information to req.user.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authorizationHeader = req.headers.authorization;

  // Ensure the Authorization header contains a Bearer token.
  if (!authorizationHeader?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      data: null,
      error: {
        message: "Authentication is required to access this resource.",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  const accessToken = authorizationHeader.slice(7).trim();

  if (!accessToken) {
    res.status(401).json({
      success: false,
      data: null,
      error: {
        message: "Authentication token is missing or invalid.",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Verify the access token.
  let tokenPayload;

  try {
    tokenPayload = await verifyAccessToken(accessToken);
  } catch {
    res.status(401).json({
      success: false,
      data: null,
      error: {
        message: "Authentication token is invalid or has expired.",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  try {
    // Confirm that this access token belongs to an active session family.
    const activeSession = await prisma.refreshSession.findFirst({
      where: {
        userId: tokenPayload.userId,
        sessionId: tokenPayload.sessionId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
      },
    });

    // Reject tokens whose session family has been revoked or expired.
    if (!activeSession) {
      res.status(401).json({
        success: false,
        data: null,
        error: {
          message: "Your authentication session is no longer active.",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }
    // Retrieve the user's current account information.
    const user = await prisma.user.findUnique({
      where: {
        id: tokenPayload.userId,
      },
      select: {
        id: true,
        username: true,
        role: true,
        mustChangePassword: true,
        isActive: true,
      },
    });

    // Reject deleted or inactive accounts.
    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        data: null,
        error: {
          message: "Your account is unavailable or inactive.",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Attach current database information to the request.
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      sessionId: tokenPayload.sessionId,
    };

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);

    res.status(500).json({
      success: false,
      data: null,
      error: {
        message: "An unexpected error occurred during authentication.",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
}
