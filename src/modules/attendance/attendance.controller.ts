import type { Request, Response } from "express";

import {
  createAttendance,
  listAttendance,
  getAttendanceById,
  updateAttendance,
  clockInEmployee,
  clockOutEmployee,
  getMyTodayAttendance,
  getMyAttendanceHistory,
  getAttendanceSettings,
  upsertAttendanceSettings,
} from "./attendance.service.js";

import {
  createAttendanceSchema,
  listAttendanceSchema,
  attendanceIdSchema,
  updateAttendanceSchema,
  attendanceSettingsSchema,
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

/**
 * Allows an authenticated employee to clock in.
 * POST /attendance/clock-in
 */
export async function clockInEmployeeController(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendResponse(res, 401, false, null, {
        message: "Authentication is required to clock in.",
      });
    }

    const attendance = await clockInEmployee(userId);

    return sendResponse(res, 201, true, attendance);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "EMPLOYEE_NOT_FOUND":
          return sendResponse(res, 404, false, null, {
            message: "Employee account not found.",
          });

        case "EMPLOYEE_INACTIVE":
          return sendResponse(res, 403, false, null, {
            message: "Inactive employees cannot record attendance.",
          });

        case "ATTENDANCE_SESSION_STILL_OPEN":
          return sendResponse(res, 409, false, null, {
            message:
              "You still have an open attendance session. Please clock out before starting another session.",
          });

        case "ATTENDANCE_POLICY_NOT_CONFIGURED":
          return sendResponse(res, 409, false, null, {
            message:
              "The company's attendance policy has not been configured. Please contact your administrator.",
          });

        case "NON_WORKING_DAY":
          return sendResponse(res, 403, false, null, {
            message:
              "Today is not a configured working day. You cannot clock in.",
          });

        case "UNABLE_TO_DETERMINE_ATTENDANCE_DATE":
          return sendResponse(res, 500, false, null, {
            message: "Unable to determine the attendance date.",
          });
      }
    }

    if (isUniqueConstraintError(error)) {
      return sendResponse(res, 409, false, null, {
        message: "You have already clocked in for today.",
      });
    }

    console.error("Employee clock-in error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to record employee clock-in.",
    });
  }
}

/**
 * Allows an authenticated employee to clock out.
 * PATCH /attendance/clock-out
 */
export async function clockOutEmployeeController(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendResponse(res, 401, false, null, {
        message: "Authentication is required to clock out.",
      });
    }

    const attendance = await clockOutEmployee(userId);

    return sendResponse(res, 200, true, attendance);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "EMPLOYEE_NOT_FOUND":
          return sendResponse(res, 404, false, null, {
            message: "Employee account not found.",
          });

        case "EMPLOYEE_INACTIVE":
          return sendResponse(res, 403, false, null, {
            message: "Inactive employees cannot record attendance.",
          });

        case "ATTENDANCE_NOT_FOUND":
          return sendResponse(res, 404, false, null, {
            message:
              "No attendance record was found for today. Please clock in first.",
          });

        case "CLOCK_IN_REQUIRED":
          return sendResponse(res, 400, false, null, {
            message: "You must clock in before clocking out.",
          });

        case "ALREADY_CLOCKED_OUT":
          return sendResponse(res, 409, false, null, {
            message: "You have already clocked out for today.",
          });

        case "UNABLE_TO_DETERMINE_ATTENDANCE_DATE":
          return sendResponse(res, 500, false, null, {
            message: "Unable to determine the attendance date.",
          });

        case "ATTENDANCE_POLICY_NOT_CONFIGURED":
          return sendResponse(res, 409, false, null, {
            message:
              "The company's attendance policy is not configured. Please contact your administrator.",
          });
      }
    }

    console.error("Employee clock-out error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to record employee clock-out.",
    });
  }
}

/**
 * Retrieves today's attendance for the authenticated employee.
 * GET /attendance/me/today
 */
export async function getMyTodayAttendanceController(
  req: Request,
  res: Response,
) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendResponse(res, 401, false, null, {
        message: "Authentication is required to retrieve attendance.",
      });
    }

    const attendance = await getMyTodayAttendance(userId);

    return sendResponse(res, 200, true, attendance);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "EMPLOYEE_NOT_FOUND":
          return sendResponse(res, 404, false, null, {
            message: "Employee account not found.",
          });

        case "EMPLOYEE_INACTIVE":
          return sendResponse(res, 403, false, null, {
            message: "Inactive employees cannot access attendance records.",
          });

        case "ATTENDANCE_POLICY_NOT_CONFIGURED":
          return sendResponse(res, 409, false, null, {
            message:
              "The company's attendance policy has not been configured. Please contact your administrator.",
          });

        case "UNABLE_TO_DETERMINE_ATTENDANCE_DATE":
          return sendResponse(res, 500, false, null, {
            message: "Unable to determine the attendance date.",
          });
      }
    }

    console.error("Get today's employee attendance error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to retrieve today's attendance.",
    });
  }
}

/**
 * Retrieves attendance history for the authenticated employee.
 * GET /attendance/me
 */
export async function getMyAttendanceHistoryController(
  req: Request,
  res: Response,
) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendResponse(res, 401, false, null, {
        message: "Authentication is required to retrieve attendance history.",
      });
    }

    const attendanceRecords = await getMyAttendanceHistory(userId);

    return sendResponse(res, 200, true, attendanceRecords);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "EMPLOYEE_NOT_FOUND":
          return sendResponse(res, 404, false, null, {
            message: "Employee account not found.",
          });

        case "EMPLOYEE_INACTIVE":
          return sendResponse(res, 403, false, null, {
            message: "Inactive employees cannot access attendance records.",
          });

        case "UNABLE_TO_DETERMINE_ATTENDANCE_DATE":
          return sendResponse(res, 500, false, null, {
            message: "Unable to determine the attendance date.",
          });
      }
    }

    console.error("Get employee attendance history error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to retrieve attendance history.",
    });
  }
}

/**
 * Retrieves the company's attendance policy settings.
 * GET /attendance/settings
 */
export async function getAttendanceSettingsController(
  req: Request,
  res: Response,
) {
  try {
    const settings = await getAttendanceSettings();

    return sendResponse(res, 200, true, settings);
  } catch (error) {
    console.error("Get attendance settings error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to retrieve attendance settings.",
    });
  }
}

/**
 * Creates or updates the company's attendance policy settings.
 * PUT /attendance/settings
 */
export async function upsertAttendanceSettingsController(
  req: Request,
  res: Response,
) {
  const validation = attendanceSettingsSchema.safeParse(req.body);

  if (!validation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid attendance settings.",
      details: validation.error.issues,
    });
  }

  try {
    const settings = await upsertAttendanceSettings(validation.data);

    return sendResponse(res, 200, true, settings);
  } catch (error) {
    console.error("Save attendance settings error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to save attendance settings.",
    });
  }
}
