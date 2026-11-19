import { z } from "zod";

const attendanceStatuses = ["PRESENT", "ABSENT", "LATE", "HALF_DAY"] as const;

// Validates YYYY-MM-DD and rejects impossible calendar dates.
const attendanceDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format.")
  .refine((value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (!match) return false;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Please provide a valid calendar date.");

// Validates ISO 8601 timestamps with timezone information.
const attendanceTimestampSchema = z.string().datetime({
  offset: true,
  message: "Please provide a valid ISO 8601 timestamp with timezone.",
});

// CREATE ATTENDANCE

export const createAttendanceSchema = z
  .object({
    employeeId: z.string().trim().min(1, "Employee ID is required."),

    date: attendanceDateSchema,

    status: z.enum(attendanceStatuses),

    checkInAt: attendanceTimestampSchema.optional().nullable(),

    checkOutAt: attendanceTimestampSchema.optional().nullable(),

    notes: z
      .string()
      .trim()
      .max(1000, "Notes must not exceed 1000 characters.")
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      if (!data.checkInAt || !data.checkOutAt) {
        return true;
      }

      return (
        new Date(data.checkOutAt).getTime() >=
        new Date(data.checkInAt).getTime()
      );
    },
    {
      message: "Check-out time cannot be earlier than check-in time.",
      path: ["checkOutAt"],
    },
  );

export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;

// ATTENDANCE ID

export const attendanceIdSchema = z.object({
  id: z.string().trim().min(1, "Attendance ID is required."),
});

// LIST ATTENDANCE / OVERVIEW FILTERS

export const listAttendanceSchema = z
  .object({
    employeeId: z.string().trim().min(1).optional(),

    departmentId: z.string().trim().min(1).optional(),

    date: attendanceDateSchema.optional(),

    startDate: attendanceDateSchema.optional(),

    endDate: attendanceDateSchema.optional(),

    status: z.enum(["all", ...attendanceStatuses]).default("all"),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }

      return true;
    },
    {
      message: "Start date cannot be later than end date.",
      path: ["startDate"],
    },
  )
  .refine(
    (data) => {
      return !(data.date && (data.startDate || data.endDate));
    },
    {
      message: "Use either an exact date or a date range, not both.",
      path: ["date"],
    },
  );

export type ListAttendanceInput = z.infer<typeof listAttendanceSchema>;

// UPDATE ATTENDANCE

export const updateAttendanceSchema = z
  .object({
    date: attendanceDateSchema.optional(),

    status: z.enum(attendanceStatuses).optional(),

    checkInAt: attendanceTimestampSchema.optional().nullable(),

    checkOutAt: attendanceTimestampSchema.optional().nullable(),

    notes: z
      .string()
      .trim()
      .max(1000, "Notes must not exceed 1000 characters.")
      .nullable()
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field must be provided for an update.",
  )
  .refine(
    (data) => {
      if (!data.checkInAt || !data.checkOutAt) {
        return true;
      }

      return (
        new Date(data.checkOutAt).getTime() >=
        new Date(data.checkInAt).getTime()
      );
    },
    {
      message: "Check-out time cannot be earlier than check-in time.",
      path: ["checkOutAt"],
    },
  );

export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
