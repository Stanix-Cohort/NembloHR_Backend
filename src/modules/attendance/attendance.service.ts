import { prisma } from "../../database/prisma.js";

import type {
  CreateAttendanceInput,
  ListAttendanceInput,
  UpdateAttendanceInput,
} from "./attendance.validation.js";

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
