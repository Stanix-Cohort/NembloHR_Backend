import { prisma } from "../../database/prisma.js";

import type {
  CreateAttendanceInput,
  ListAttendanceInput,
  UpdateAttendanceInput,
  AttendanceSettingsInput,
} from "./attendance.validation.js";


/**
 * Retrieves the attendance settings for this company.
 *
 * Returns null if the company has not configured its
 * attendance policy yet.
 */
export async function getAttendanceSettings() {
  return prisma.attendanceSettings.findUnique({
    where: {
      id: "default",
    },
    select: {
      id: true,
      resumptionTime: true,
      closingTime: true,
      gracePeriodMinutes: true,
      timezone: true,
      workingDays: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Creates or updates the attendance settings.
 *
 * A fixed ID ensures one settings record per
 * company deployment.
 */
export async function upsertAttendanceSettings(
  input: AttendanceSettingsInput,
) {
  return prisma.attendanceSettings.upsert({
    where: {
      id: "default",
    },

    create: {
      id: "default",
      resumptionTime: input.resumptionTime,
      closingTime: input.closingTime,
      gracePeriodMinutes: input.gracePeriodMinutes,
      timezone: input.timezone,
      workingDays: input.workingDays,
    },

    update: {
      resumptionTime: input.resumptionTime,
      closingTime: input.closingTime,
      gracePeriodMinutes: input.gracePeriodMinutes,
      timezone: input.timezone,
      workingDays: input.workingDays,
    },

    select: {
      id: true,
      resumptionTime: true,
      closingTime: true,
      gracePeriodMinutes: true,
      timezone: true,
      workingDays: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}


/**
 * Converts a date-only string (YYYY-MM-DD) to UTC midnight.
 * This keeps attendance dates consistent with the PostgreSQL DATE column.
 */
function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * Creates an attendance record for an employee.
 *
 * - Verifies that the employee exists.
 * - Prevents duplicate attendance for the same employee and date.
 * - Records the authenticated Admin who created the entry.
 */
export async function createAttendance(
  input: CreateAttendanceInput,
  recordedById: string,
) {
  const date = toDateOnly(input.date);

  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findUnique({
      where: {
        id: input.employeeId,
      },
      select: {
        id: true,
      },
    });

    if (!employee) {
      throw new Error("EMPLOYEE_NOT_FOUND");
    }

    const existingAttendance = await tx.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: input.employeeId,
          date,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingAttendance) {
      throw new Error("ATTENDANCE_ALREADY_EXISTS");
    }

    return tx.attendance.create({
      data: {
        employeeId: employee.id,
        date,
        status: input.status,
        checkInAt: input.checkInAt ? new Date(input.checkInAt) : null,
        checkOutAt: input.checkOutAt ? new Date(input.checkOutAt) : null,
        notes: input.notes?.trim() || null,
        recordedById,
      },
      select: {
        id: true,
        date: true,
        status: true,
        checkInAt: true,
        checkOutAt: true,
        notes: true,
        employee: {
          select: {
            id: true,
            fullName: true,
            workEmail: true,
            jobTitle: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        recordedBy: {
          select: {
            id: true,
            username: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });
  });
}

/**
 * Retrieves attendance records.
 *
 * Supports filtering by:
 * - Employee
 * - Department
 * - Exact date
 * - Date range
 * - Attendance status
 */
export async function listAttendance(filters: ListAttendanceInput) {
  const {
    employeeId,
    departmentId,
    date,
    startDate,
    endDate,
    status = "all",
  } = filters;

  return prisma.attendance.findMany({
    where: {
      ...(employeeId && {
        employeeId,
      }),

      ...(departmentId && {
        employee: {
          is: {
            departmentId,
          },
        },
      }),

      ...(date && {
        date: toDateOnly(date),
      }),

      ...(!date &&
        (startDate || endDate) && {
          date: {
            ...(startDate && {
              gte: toDateOnly(startDate),
            }),
            ...(endDate && {
              lte: toDateOnly(endDate),
            }),
          },
        }),

      ...(status !== "all" && {
        status,
      }),
    },

    orderBy: [
      {
        date: "desc",
      },
      {
        employee: {
          fullName: "asc",
        },
      },
    ],

    select: {
      id: true,
      date: true,
      status: true,
      checkInAt: true,
      checkOutAt: true,
      notes: true,
      employee: {
        select: {
          id: true,
          fullName: true,
          workEmail: true,
          jobTitle: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      recordedBy: {
        select: {
          id: true,
          username: true,
        },
      },
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Retrieves an individual attendance record by ID.
 *
 * Returns null when the record does not exist.
 */
export async function getAttendanceById(id: string) {
  return prisma.attendance.findUnique({
    where: {
      id,
    },

    select: {
      id: true,
      date: true,
      status: true,
      checkInAt: true,
      checkOutAt: true,
      notes: true,
      employee: {
        select: {
          id: true,
          fullName: true,
          workEmail: true,
          jobTitle: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      recordedBy: {
        select: {
          id: true,
          username: true,
        },
      },
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Updates an existing attendance record.
 *
 * Checks the combined check-in and check-out values, including
 * existing values that are not being changed in the request.
 */
export async function updateAttendance(
  id: string,
  input: UpdateAttendanceInput,
) {
  const existingAttendance = await prisma.attendance.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      employeeId: true,
      date: true,
      checkInAt: true,
      checkOutAt: true,
    },
  });

  if (!existingAttendance) {
    throw new Error("ATTENDANCE_NOT_FOUND");
  }

  const nextCheckInAt =
    input.checkInAt !== undefined
      ? input.checkInAt
        ? new Date(input.checkInAt)
        : null
      : existingAttendance.checkInAt;

  const nextCheckOutAt =
    input.checkOutAt !== undefined
      ? input.checkOutAt
        ? new Date(input.checkOutAt)
        : null
      : existingAttendance.checkOutAt;

  if (
    nextCheckInAt &&
    nextCheckOutAt &&
    nextCheckOutAt.getTime() < nextCheckInAt.getTime()
  ) {
    throw new Error("CHECK_OUT_BEFORE_CHECK_IN");
  }

  const nextDate = input.date
    ? toDateOnly(input.date)
    : existingAttendance.date;

  // Prevent moving this record onto another attendance record
  // belonging to the same employee on the same date.
  if (input.date) {
    const duplicateAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: existingAttendance.employeeId,
        date: nextDate,
        NOT: {
          id,
        },
      },
      select: {
        id: true,
      },
    });

    if (duplicateAttendance) {
      throw new Error("ATTENDANCE_ALREADY_EXISTS");
    }
  }

  return prisma.attendance.update({
    where: {
      id,
    },

    data: {
      ...(input.date !== undefined && {
        date: nextDate,
      }),

      ...(input.status !== undefined && {
        status: input.status,
      }),

      ...(input.checkInAt !== undefined && {
        checkInAt: nextCheckInAt,
      }),

      ...(input.checkOutAt !== undefined && {
        checkOutAt: nextCheckOutAt,
      }),

      ...(input.notes !== undefined && {
        notes: input.notes?.trim() || null,
      }),
    },

    select: {
      id: true,
      date: true,
      status: true,
      checkInAt: true,
      checkOutAt: true,
      notes: true,
      employee: {
        select: {
          id: true,
          fullName: true,
          workEmail: true,
          jobTitle: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      recordedBy: {
        select: {
          id: true,
          username: true,
        },
      },
      createdAt: true,
      updatedAt: true,
    },
  });
}


/**
 * Gets today's date in the company's timezone.
 * Attendance dates are based on Africa/Lagos, not the server timezone.
 */
function getNigeriaAttendanceDate(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("UNABLE_TO_DETERMINE_ATTENDANCE_DATE");
  }

  return toDateOnly(`${year}-${month}-${day}`);
}

/**
 * Employee clock-in.
 *
 * - Identifies the employee through their authenticated user ID.
 * - Rejects inactive employees.
 * - Allows only one attendance record per employee per day.
 * - Uses the server's current timestamp.
 */
export async function clockInEmployee(userId: string) {
  const employee = await prisma.employee.findUnique({
    where: {
      userId,
    },
    select: {
      id: true,
      employmentStatus: true,
    },
  });

  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }

  if (employee.employmentStatus !== "ACTIVE") {
    throw new Error("EMPLOYEE_INACTIVE");
  }

  const date = getNigeriaAttendanceDate();
  const checkInAt = new Date();

  return prisma.attendance.create({
    data: {
      employeeId: employee.id,
      date,
      status: "PRESENT",
      checkInAt,
      recordedById: userId,
    },
    select: {
      id: true,
      date: true,
      status: true,
      checkInAt: true,
      checkOutAt: true,
      createdAt: true,
    },
  });
}

/**
 * Employee clock-out.
 *
 * - Finds today's attendance record.
 * - Requires a previous clock-in.
 * - Prevents repeated clock-out attempts.
 * - Uses the server's current timestamp.
 */
export async function clockOutEmployee(userId: string) {
  const employee = await prisma.employee.findUnique({
    where: {
      userId,
    },
    select: {
      id: true,
      employmentStatus: true,
    },
  });

  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }

  if (employee.employmentStatus !== "ACTIVE") {
    throw new Error("EMPLOYEE_INACTIVE");
  }

  const date = getNigeriaAttendanceDate();

  const attendance = await prisma.attendance.findUnique({
    where: {
      employeeId_date: {
        employeeId: employee.id,
        date,
      },
    },
    select: {
      id: true,
      checkInAt: true,
      checkOutAt: true,
    },
  });

  if (!attendance) {
    throw new Error("ATTENDANCE_NOT_FOUND");
  }

  if (!attendance.checkInAt) {
    throw new Error("CLOCK_IN_REQUIRED");
  }

  if (attendance.checkOutAt) {
    throw new Error("ALREADY_CLOCKED_OUT");
  }

  const checkOutAt = new Date();

  // Conditional update prevents concurrent requests from
  // overwriting an existing clock-out timestamp.
  const result = await prisma.attendance.updateMany({
    where: {
      id: attendance.id,
      checkOutAt: null,
    },
    data: {
      checkOutAt,
    },
  });

  if (result.count === 0) {
    throw new Error("ALREADY_CLOCKED_OUT");
  }

  return prisma.attendance.findUnique({
    where: {
      id: attendance.id,
    },
    select: {
      id: true,
      date: true,
      status: true,
      checkInAt: true,
      checkOutAt: true,
      updatedAt: true,
    },
  });
}


/**
 * Calculates the time worked from check-in to check-out.
 *
 * Incomplete attendance records return null values.
 * The result is calculated from server-recorded timestamps.
 */
function calculateWorkingDuration(
  checkInAt: Date | null,
  checkOutAt: Date | null,
) {
  if (!checkInAt || !checkOutAt) {
    return {
      workedMinutes: null,
      hoursWorked: null,
    };
  }

  const difference =
    checkOutAt.getTime() - checkInAt.getTime();

  if (difference < 0) {
    return {
      workedMinutes: null,
      hoursWorked: null,
    };
  }

  const workedMinutes = Math.floor(difference / 60000);

  return {
    workedMinutes,
    hoursWorked: Number((workedMinutes / 60).toFixed(2)),
  };
}

/**
 * Retrieves today's attendance for the authenticated employee.
 */
export async function getMyTodayAttendance(userId: string) {
  const employee = await prisma.employee.findUnique({
    where: {
      userId,
    },
    select: {
      id: true,
      employmentStatus: true,
    },
  });

  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }

  if (employee.employmentStatus !== "ACTIVE") {
    throw new Error("EMPLOYEE_INACTIVE");
  }

  const date = getNigeriaAttendanceDate();

  const attendance = await prisma.attendance.findUnique({
    where: {
      employeeId_date: {
        employeeId: employee.id,
        date,
      },
    },
    select: {
      id: true,
      date: true,
      status: true,
      checkInAt: true,
      checkOutAt: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!attendance) {
    return null;
  }

  return {
    ...attendance,
    ...calculateWorkingDuration(
      attendance.checkInAt,
      attendance.checkOutAt,
    ),
  };
}

/**
 * Retrieves all attendance records belonging to the
 * authenticated employee.
 *
 * Employees cannot retrieve another employee's records.
 */
export async function getMyAttendanceHistory(userId: string) {
  const employee = await prisma.employee.findUnique({
    where: {
      userId,
    },
    select: {
      id: true,
      employmentStatus: true,
    },
  });

  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }

  if (employee.employmentStatus !== "ACTIVE") {
    throw new Error("EMPLOYEE_INACTIVE");
  }

  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      employeeId: employee.id,
    },
    orderBy: [
      {
        date: "desc",
      },
    ],
    select: {
      id: true,
      date: true,
      status: true,
      checkInAt: true,
      checkOutAt: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return attendanceRecords.map((attendance) => ({
    ...attendance,
    ...calculateWorkingDuration(
      attendance.checkInAt,
      attendance.checkOutAt,
    ),
  }));
}
