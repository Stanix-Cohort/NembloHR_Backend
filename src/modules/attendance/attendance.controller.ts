import type { Request, Response } from "express";

import {
  createAttendance,
  listAttendance,
  getAttendanceById,
  updateAttendance,
} from "./attendance.service.js";

import {
  createAttendanceSchema,
  listAttendanceSchema,
  attendanceIdSchema,
  updateAttendanceSchema,
} from "./attendance.validation.js";

/**
 * Sends a consistent API response.
 */
function sendResponse(
  res: Response,
  statusCode: number,
  success: boolean,
  data: unknown = null,
  error: { message: string; details?: unknown } | null = null,
) {
  return res.status(statusCode).json({
    success,
    data,
    error,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Checks whether an error is a Prisma unique constraint violation.
 */
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

/**
 * Creates an attendance record.
 * POST /attendance
 */
export async function createAttendanceController(req: Request, res: Response) {
  const validation = createAttendanceSchema.safeParse(req.body);

  if (!validation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid attendance information.",
      details: validation.error.issues,
    });
  }

  try {
    const recordedById = req.user?.id;

    if (!recordedById) {
      return sendResponse(res, 401, false, null, {
        message: "Authentication is required to record attendance.",
      });
    }

    const attendance = await createAttendance(validation.data, recordedById);

    return sendResponse(res, 201, true, attendance);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "EMPLOYEE_NOT_FOUND":
          return sendResponse(res, 404, false, null, {
            message: "The selected employee does not exist.",
          });

        case "ATTENDANCE_ALREADY_EXISTS":
          return sendResponse(res, 409, false, null, {
            message:
              "Attendance has already been recorded for this employee on this date.",
          });
      }
    }

    if (isUniqueConstraintError(error)) {
      return sendResponse(res, 409, false, null, {
        message:
          "Attendance has already been recorded for this employee on this date.",
      });
    }

    console.error("Create attendance error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to create attendance record.",
    });
  }
}

/**
 * Retrieves attendance records.
 * GET /attendance
 */
export async function listAttendanceController(req: Request, res: Response) {
  const validation = listAttendanceSchema.safeParse(req.query);

  if (!validation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid attendance filters.",
      details: validation.error.issues,
    });
  }

  try {
    const attendanceRecords = await listAttendance(validation.data);

    return sendResponse(res, 200, true, attendanceRecords);
  } catch (error) {
    console.error("List attendance error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to retrieve attendance records.",
    });
  }
}

/**
 * Retrieves an individual attendance record by ID.
 * GET /attendance/:id
 */
export async function getAttendanceByIdController(req: Request, res: Response) {
  const validation = attendanceIdSchema.safeParse(req.params);

  if (!validation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid attendance ID.",
      details: validation.error.issues,
    });
  }

  try {
    const attendance = await getAttendanceById(validation.data.id);

    if (!attendance) {
      return sendResponse(res, 404, false, null, {
        message: "Attendance record not found.",
      });
    }

    return sendResponse(res, 200, true, attendance);
  } catch (error) {
    console.error("Get attendance error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to retrieve attendance record.",
    });
  }
}

/**
 * Updates an existing attendance record.
 * PATCH /attendance/:id
 */
export async function updateAttendanceController(req: Request, res: Response) {
  const paramsValidation = attendanceIdSchema.safeParse(req.params);

  if (!paramsValidation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid attendance ID.",
      details: paramsValidation.error.issues,
    });
  }

  const bodyValidation = updateAttendanceSchema.safeParse(req.body);

  if (!bodyValidation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid attendance update information.",
      details: bodyValidation.error.issues,
    });
  }

  try {
    const attendance = await updateAttendance(
      paramsValidation.data.id,
      bodyValidation.data,
    );

    return sendResponse(res, 200, true, attendance);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "ATTENDANCE_NOT_FOUND":
          return sendResponse(res, 404, false, null, {
            message: "Attendance record not found.",
          });

        case "ATTENDANCE_ALREADY_EXISTS":
          return sendResponse(res, 409, false, null, {
            message:
              "Attendance has already been recorded for this employee on this date.",
          });

        case "CHECK_OUT_BEFORE_CHECK_IN":
          return sendResponse(res, 400, false, null, {
            message: "Check-out time cannot be earlier than check-in time.",
          });
      }
    }

    if (isUniqueConstraintError(error)) {
      return sendResponse(res, 409, false, null, {
        message:
          "Attendance has already been recorded for this employee on this date.",
      });
    }

    console.error("Update attendance error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to update attendance record.",
    });
  }
}
