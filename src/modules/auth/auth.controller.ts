import type { Request, Response } from "express";

import { authConfig } from "../../config/auth.js";
import { generateAccessToken } from "../../utils/token.js";

import {
  rotateRefreshSession,
  revokeRefreshSession,
} from "./session.service.js";

import { loginSchema, changePasswordSchema } from "./auth.validation.js";

import { login, changePassword } from "./auth.service.js";

const REFRESH_COOKIE_NAME = "nemblo_refresh_token";

// Shared cookie settings used when setting and clearing the cookie.
const refreshCookieBaseOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite:
    process.env.NODE_ENV === "production"
      ? ("none" as const)
      : ("lax" as const),
  path: "/api/v1/auth",
};

// Cookie lifetime follows the central authentication configuration.
const refreshCookieOptions = {
  ...refreshCookieBaseOptions,
  maxAge: authConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
};

/**
 * Authenticates an existing Admin or Employee.
 */
export async function loginController(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    // Validate the incoming request.
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: "Invalid login details.",
          details: validation.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Authenticate the user.
    const result = await login(validation.data);

    if (!result) {
      res.status(401).json({
        success: false,
        data: null,
        error: {
          message: "Invalid username or password.",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Deliver the refresh token through an HTTP-only cookie.
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions);

    // Return the access token and safe user information.
    res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
      error: null,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Login controller error:", error);

    res.status(500).json({
      success: false,
      data: null,
      error: {
        message: "An unexpected error occurred during login.",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Issues a new access token and rotates the refresh session.
 */
export async function refreshController(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (typeof refreshToken !== "string" || !refreshToken) {
      res.status(401).json({
        success: false,
        data: null,
        error: {
          message: "Authentication session is missing or invalid.",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    const result = await rotateRefreshSession(refreshToken);

    // Unknown, expired or otherwise invalid refresh token.
    if (!result) {
      res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieBaseOptions);

      res.status(401).json({
        success: false,
        data: null,
        error: {
          message: "Authentication session is missing or invalid.",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });

      return;
    }

    // Another request has already rotated this token recently.
    // Do not clear the cookie: another response may deliver its replacement.
    if (result.kind === "concurrent") {
      res.status(409).json({
        success: false,
        data: null,
        error: {
          code: "REFRESH_ALREADY_ROTATED",
          message: "This refresh request has already been processed.",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });

      return;
    }

    // A previously rotated token was reused outside the grace period.
    // The session family has been revoked.
    if (result.kind === "reuse") {
      res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieBaseOptions);

      res.status(401).json({
        success: false,
        data: null,
        error: {
          code: "REFRESH_TOKEN_REUSE_DETECTED",
          message:
            "Your authentication session is no longer valid. Please log in again.",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });

      return;
    }

    const accessToken = await generateAccessToken({
      userId: result.user.id,
      username: result.user.username,
      role: result.user.role,
      sessionId: result.sessionId,
    });

    // Replace the old refresh cookie with the rotated token.
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions);

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        user: {
          id: result.user.id,
          username: result.user.username,
          role: result.user.role,
          mustChangePassword: result.user.mustChangePassword,
        },
      },
      error: null,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Refresh controller error:", error);

    res.status(500).json({
      success: false,
      data: null,
      error: {
        message: "An unexpected error occurred while refreshing the session.",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Logs out the current user by revoking their refresh session.
 */
export async function logoutController(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (typeof refreshToken === "string" && refreshToken) {
      await revokeRefreshSession(refreshToken);
    }

    // Clear the browser's refresh-token cookie.
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieBaseOptions);

    res.status(200).json({
      success: true,
      data: null,
      error: null,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Logout controller error:", error);

    res.status(500).json({
      success: false,
      data: null,
      error: {
        message: "An unexpected error occurred during logout.",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Changes the authenticated user's password.
 *
 * Supports both first-login password changes and
 * subsequent password changes.
 */
export async function changePasswordController(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    // Ensure the request has an authenticated user.
    if (!req.user) {
      res.status(401).json({
        success: false,
        data: null,
        error: {
          message: "Authentication is required to change your password.",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Validate the submitted password details.
    const validation = changePasswordSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: "Invalid password-change details.",
          details: validation.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Retrieve the current refresh token from the HTTP-only cookie.
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    // Perform the password-change operation.
    const result = await changePassword(
      req.user.id,
      validation.data,
      typeof refreshToken === "string" ? refreshToken : undefined,
    );

    if (!result.success) {
      if (result.reason === "INVALID_CURRENT_PASSWORD") {
        res.status(401).json({
          success: false,
          data: null,
          error: {
            message: "The current password you provided is incorrect.",
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      res.status(401).json({
        success: false,
        data: null,
        error: {
          message:
            "Your account is unavailable. Please contact an administrator.",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Confirm successful password change.
    res.status(200).json({
      success: true,
      data: {
        message: "Your password has been changed successfully.",
        mustChangePassword: false,
      },
      error: null,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Change password controller error:", error);

    res.status(500).json({
      success: false,
      data: null,
      error: {
        message: "An unexpected error occurred while changing your password.",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
}


/**
 * Returns the currently authenticated user's information.
 */
export async function getCurrentUserController(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
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

    res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
      error: null,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Get current user controller error:", error);

    res.status(500).json({
      success: false,
      data: null,
      error: {
        message: "An unexpected error occurred while retrieving your account.",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
}
