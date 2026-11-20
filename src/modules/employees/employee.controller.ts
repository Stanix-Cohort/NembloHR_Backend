import type { Request, Response } from "express";

import {
  createEmployee,
  listEmployees,
  getEmployeeById,
  getMyEmployeeProfile,
  updateEmployee,
  updateEmployeeStatus,
  resetEmployeePassword,
} from "./employee.service.js";

import {
  createEmployeeSchema,
  listEmployeesSchema,
  employeeIdSchema,
  updateEmployeeSchema,
  updateEmployeeStatusSchema,
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
export async function listEmployeesController(req: Request, res: Response) {
  const validation = listEmployeesSchema.safeParse(req.query);

  if (!validation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid employee directory filters.",
      details: validation.error.issues,
    });
  }

  try {
    const employees = await listEmployees(validation.data);

    return sendResponse(res, 200, true, employees);
  } catch (error) {
    console.error("List employees error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to retrieve employees.",
    });
  }
}

/**
 * Retrieves an individual employee by ID.
 */
export async function getEmployeeByIdController(req: Request, res: Response) {
  const validation = employeeIdSchema.safeParse(req.params);

  if (!validation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid employee ID.",
      details: validation.error.issues,
    });
  }

  try {
    const employee = await getEmployeeById(validation.data.id);

    if (!employee) {
      return sendResponse(res, 404, false, null, {
        message: "Employee not found.",
      });
    }

    return sendResponse(res, 200, true, employee);
  } catch (error) {
    console.error("Get employee error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to retrieve employee.",
    });
  }
}

export async function getMyEmployeeProfileController(
  req: Request,
  res: Response,
) {
  try {
    if (!req.user) {
      return sendResponse(res, 401, false, null, {
        message: "Authentication required.",
      });
    }

    const employee = await getMyEmployeeProfile(req.user.id);

    if (!employee) {
      return sendResponse(res, 404, false, null, {
        message: "Employee profile not found.",
      });
    }

    return sendResponse(res, 200, true, employee);
  } catch (error) {
    console.error("Get my employee profile error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Failed to retrieve employee profile.",
    });
  }
}

/**
 * Updates an employee's HR information.
 * PATCH /employees/:id
 */
export async function updateEmployeeController(req: Request, res: Response) {
  const paramsValidation = employeeIdSchema.safeParse(req.params);
  const bodyValidation = updateEmployeeSchema.safeParse(req.body);

  if (!paramsValidation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid employee ID.",
      details: paramsValidation.error.issues,
    });
  }

  if (!bodyValidation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid employee information.",
      details: bodyValidation.error.issues,
    });
  }

  try {
    const employee = await updateEmployee(
      paramsValidation.data.id,
      bodyValidation.data,
    );

    return sendResponse(res, 200, true, employee);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "EMPLOYEE_NOT_FOUND":
          return sendResponse(res, 404, false, null, {
            message: "Employee not found.",
          });

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
            message: "Another employee is already using this work email.",
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

    console.error("Update employee error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to update employee.",
    });
  }
}

/**
 * Activates or deactivates an employee account.
 * PATCH /employees/:id/status
 */
export async function updateEmployeeStatusController(
  req: Request,
  res: Response,
) {
  const paramsValidation = employeeIdSchema.safeParse(req.params);
  const bodyValidation = updateEmployeeStatusSchema.safeParse(req.body);

  if (!paramsValidation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid employee ID.",
      details: paramsValidation.error.issues,
    });
  }

  if (!bodyValidation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid employee status.",
      details: bodyValidation.error.issues,
    });
  }

  try {
    const employee = await updateEmployeeStatus(
      paramsValidation.data.id,
      bodyValidation.data,
    );

    return sendResponse(res, 200, true, employee);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "EMPLOYEE_NOT_FOUND":
          return sendResponse(res, 404, false, null, {
            message: "Employee not found.",
          });

        case "EMPLOYEE_ACCOUNT_NOT_FOUND":
          return sendResponse(res, 404, false, null, {
            message: "The employee's login account could not be found.",
          });
      }
    }

    console.error("Update employee status error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to update employee status.",
    });
  }
}

/**
 * Resets an active employee's login password.
 * POST /employees/:id/reset-password
 */
export async function resetEmployeePasswordController(
  req: Request,
  res: Response,
) {
  const validation = employeeIdSchema.safeParse(req.params);

  if (!validation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid employee ID.",
      details: validation.error.issues,
    });
  }

  try {
    const result = await resetEmployeePassword(validation.data.id);

    return sendResponse(res, 200, true, result);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "EMPLOYEE_NOT_FOUND":
          return sendResponse(res, 404, false, null, {
            message: "Employee not found.",
          });

        case "EMPLOYEE_ACCOUNT_NOT_FOUND":
          return sendResponse(res, 404, false, null, {
            message: "The employee's login account could not be found.",
          });

        case "EMPLOYEE_ACCOUNT_INACTIVE":
          return sendResponse(res, 403, false, null, {
            message: "Password reset is only available for active employees.",
          });
      }
    }

    console.error("Reset employee password error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to reset employee password.",
    });
  }
}
