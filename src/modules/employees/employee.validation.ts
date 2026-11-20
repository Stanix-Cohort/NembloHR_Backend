import { z } from "zod";

/**
 * Validates employee creation requests.
 */
export const createEmployeeSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Employee name must contain at least 2 characters.")
    .max(150, "Employee name must not exceed 150 characters."),

  workEmail: z
    .string()
    .trim()
    .email("Please provide a valid work email address.")
    .max(254, "Work email must not exceed 254 characters.")
    .transform((email) => email.toLowerCase()),

  phone: z
    .string()
    .trim()
    .max(30, "Phone number must not exceed 30 characters.")
    .nullable()
    .optional(),

  departmentId: z.string().trim().min(1, "Department selection is required."),

  jobTitle: z
    .string()
    .trim()
    .min(2, "Job title must contain at least 2 characters.")
    .max(100, "Job title must not exceed 100 characters."),

  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must use YYYY-MM-DD format.")
    .refine((value) => {
      const year = Number(value.slice(0, 4));
      const month = Number(value.slice(5, 7));
      const day = Number(value.slice(8, 10));

      const date = new Date(Date.UTC(year, month - 1, day));

      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      );
    }, "Please provide a valid calendar date."),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
/**
 * Validates partial employee update requests.
 */
export const updateEmployeeSchema = createEmployeeSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one employee field must be provided for an update.",
  );

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

/**
 * Validates employee account status update requests.
 */
export const updateEmployeeStatusSchema = z.object({
  employmentStatus: z.enum(["ACTIVE", "INACTIVE"]),
});

export type UpdateEmployeeStatusInput = z.infer<
  typeof updateEmployeeStatusSchema
>;

/**
 * Validates employee ID route parameters.
 */
export const employeeIdSchema = z.object({
  id: z.string().trim().min(1, "Employee ID is required."),
});

/**
 * Validates employee directory filters.
 */
export const listEmployeesSchema = z.object({
  search: z.string().trim().max(100).optional(),

  departmentId: z.string().trim().optional(),

  status: z.enum(["all", "active", "inactive"]).default("all"),
});

export type ListEmployeesInput = z.infer<typeof listEmployeesSchema>;
