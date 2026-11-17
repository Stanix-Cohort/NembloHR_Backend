import type { Request, Response } from "express";

/**
 * Temporary endpoint for testing Admin-only access.
 */
export function adminTestController(req: Request, res: Response): void {
  res.status(200).json({
    success: true,
    data: {
      message: "Admin access granted successfully.",
      user: req.user,
    },
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}

export function employeeTestController(req: Request, res: Response): void {
  res.status(200).json({
    success: true,
    data: {
      message: "Employee access granted successfully.",
      user: req.user,
    },
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}
