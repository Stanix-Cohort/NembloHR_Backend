import { z } from "zod";

/**
 * Validates department creation requests.
 */
export const createDepartmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Department name must contain at least 2 characters.")
    .max(100, "Department name must not exceed 100 characters."),

  description: z
    .string()
    .trim()
    .max(500, "Department description must not exceed 500 characters.")
    .nullable()
    .optional(),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

/**
 * Validates department update requests.
 */
export const updateDepartmentSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Department name must contain at least 2 characters.")
      .max(100, "Department name must not exceed 100 characters.")
      .optional(),

    description: z
      .string()
      .trim()
      .max(500, "Department description must not exceed 500 characters.")
      .nullable()
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

/**
 * Validates department ID route parameters.
 */
export const departmentIdSchema = z.object({
  id: z.string().trim().min(1, "Department ID is required."),
});

/**
 * Validates department directory filters.
 */
export const listDepartmentsSchema = z.object({
  search: z.string().trim().max(100).optional(),

  status: z.enum(["all", "active", "inactive"]).default("all"),
});

/**
 * Validates department activation status updates.
 */
export const updateDepartmentStatusSchema = z.object({
  isActive: z.boolean({
    error: "Department status must be a boolean.",
  }),
});

export type UpdateDepartmentStatusInput = z.infer<
  typeof updateDepartmentStatusSchema
>;
