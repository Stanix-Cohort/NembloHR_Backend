import type { Request, Response } from "express";
import { checkDatabaseConnection } from "./health.service.js";

// Liveness check: confirms that the API process is running.
export function getLiveness(_req: Request, res: Response) {
  return res.status(200).json({
    success: true,
    data: {
      status: "alive",
      service: "Nemblo HR API",
    },
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}

// Readiness check: verifies database connectivity.
export async function getReadiness(_req: Request, res: Response) {
  try {
    await checkDatabaseConnection();

    return res.status(200).json({
      success: true,
      data: {
        status: "ready",
        service: "Nemblo HR API",
        database: "connected",
      },
      error: null,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Readiness check failed:", error);

    return res.status(503).json({
      success: false,
      data: {
        status: "not_ready",
        service: "Nemblo HR API",
        database: "disconnected",
      },
      error: {
        message: "Database connection is unavailable.",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
}
