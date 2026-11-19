import type { Request, Response } from "express";

import {
  createEmployee,
  listEmployees,
  getEmployeeById,
} from "./employee.service.js";

import {
  createEmployeeSchema,
  listEmployeesSchema,
  employeeIdSchema,
} from "./employee.validation.js";
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
 * Creates a new employee and provisions their login account.
 * POST /employees
 */
export async function createEmployeeController(req: Request, res: Response) {
  const validation = createEmployeeSchema.safeParse(req.body);

  if (!validation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid employee information.",
      details: validation.error.issues,
    });
  }

  try {
    const result = await createEmployee(validation.data);

    return sendResponse(res, 201, true, result);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "DEPARTMENT_NOT_FOUND":
          return sendResponse(res, 404, false, null, {
            message: "The selected department does not exist.",
          });

        case "DEPARTMENT_INACTIVE":
          return sendResponse(res, 400, false, null, {
            message: "Employees can only be assigned to active departments.",
          });

        case "EMPLOYEE_EMAIL_EXISTS":
          return sendResponse(res, 409, false, null, {
            message: "An employee with this work email already exists.",
          });

        case "USERNAME_EXISTS":
          return sendResponse(res, 409, false, null, {
            message: "A user account with this work email already exists.",
          });
      }
    }

    if (isUniqueConstraintError(error)) {
      return sendResponse(res, 409, false, null, {
        message: "An account with these details already exists.",
      });
    }

    console.error("Create employee error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to create employee.",
    });
  }
}

/**
 * Retrieves employees for the employee directory.
 *
 * Supports search, department filtering and status filtering.
 */
export async function listEmployeesController(
  req: Request,
  res: Response,
) {
  const validation = listEmployeesSchema.safeParse(req.query);

  if (!validation.success) {
    return sendResponse(
      res,
      400,
      false,
      null,
      {
        message: "Invalid employee directory filters.",
        details: validation.error.issues,
      },
    );
  }

  try {
    const employees = await listEmployees(validation.data);

    return sendResponse(
      res,
      200,
      true,
      employees,
    );
  } catch (error) {
    console.error("List employees error:", error);

    return sendResponse(
      res,
      500,
      false,
      null,
      {
        message: "Unable to retrieve employees.",
      },
    );
  }
}

/**
 * Retrieves an individual employee by ID.
 */
export async function getEmployeeByIdController(
  req: Request,
  res: Response,
) {
  const validation = employeeIdSchema.safeParse(req.params);

  if (!validation.success) {
    return sendResponse(
      res,
      400,
      false,
      null,
      {
        message: "Invalid employee ID.",
        details: validation.error.issues,
      },
    );
  }

  try {
    const employee = await getEmployeeById(validation.data.id);

    if (!employee) {
      return sendResponse(
        res,
        404,
        false,
        null,
        {
          message: "Employee not found.",
        },
      );
    }

    return sendResponse(
      res,
      200,
      true,
      employee,
    );
  } catch (error) {
    console.error("Get employee error:", error);

    return sendResponse(
      res,
      500,
      false,
      null,
      {
        message: "Unable to retrieve employee.",
      },
    );
  }
}