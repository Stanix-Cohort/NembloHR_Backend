import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "../generated/prisma/client.js";

/**
 * Restricts access to users with the specified role(s).
 *
 * Must be used after the authenticate middleware.
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
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

    // Check whether the authenticated user has permission.
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        data: null,
        error: {
          message: "You do not have permission to access this resource.",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    next();
  };
}
