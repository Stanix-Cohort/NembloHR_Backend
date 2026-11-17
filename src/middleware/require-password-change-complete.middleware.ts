import type { Request, Response, NextFunction } from "express";

/**
 * Prevents users who must change their temporary password
 * from accessing normal application resources.
 *
 * Must run after the authenticate middleware.
 */
export function requirePasswordChangeComplete(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Authentication middleware must run first.
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

  // Restrict access until the temporary password is changed.
  if (req.user.mustChangePassword) {
    res.status(403).json({
      success: false,
      data: null,
      error: {
        code: "PASSWORD_CHANGE_REQUIRED",
        message:
          "You must change your temporary password before accessing this resource.",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  next();
}
