import type { Request, Response } from "express";

import {
  createDepartment,
  listDepartments,
  getDepartmentById,
  updateDepartment,
  updateDepartmentStatus,
} from "./department.service.js";

import {
  createDepartmentSchema,
  updateDepartmentSchema,
  departmentIdSchema,
  listDepartmentsSchema,
  updateDepartmentStatusSchema,
} from "./department.validation.js";

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
 * Creates a new department.
 * POST /departments
 */
export async function createDepartmentController(req: Request, res: Response) {
  const validation = createDepartmentSchema.safeParse(req.body);

  if (!validation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid department information.",
      details: validation.error.issues,
    });
  }

  try {
    const department = await createDepartment(validation.data);

    return sendResponse(res, 201, true, department);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return sendResponse(res, 409, false, null, {
        message: "A department with this name already exists.",
      });
    }

    console.error("Create department error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to create department.",
    });
  }
}

/**
 * Lists departments.
 * GET /departments
 */
export async function listDepartmentsController(req: Request, res: Response) {
  const validation = listDepartmentsSchema.safeParse(req.query);

  if (!validation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid department filters.",
      details: validation.error.issues,
    });
  }

  try {
    const departments = await listDepartments(validation.data);

    return sendResponse(res, 200, true, departments);
  } catch (error) {
    console.error("List departments error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to retrieve departments.",
    });
  }
}

/**
 * Retrieves one department.
 * GET /departments/:id
 */
export async function getDepartmentController(req: Request, res: Response) {
  const validation = departmentIdSchema.safeParse(req.params);

  if (!validation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid department ID.",
      details: validation.error.issues,
    });
  }

  try {
    const department = await getDepartmentById(validation.data.id);

    if (!department) {
      return sendResponse(res, 404, false, null, {
        message: "Department not found.",
      });
    }

    return sendResponse(res, 200, true, department);
  } catch (error) {
    console.error("Get department error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to retrieve department.",
    });
  }
}

/**
 * Updates department information.
 * PATCH /departments/:id
 */
export async function updateDepartmentController(req: Request, res: Response) {
  const idValidation = departmentIdSchema.safeParse(req.params);

  if (!idValidation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid department ID.",
      details: idValidation.error.issues,
    });
  }

  const bodyValidation = updateDepartmentSchema.safeParse(req.body);

  if (!bodyValidation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid department information.",
      details: bodyValidation.error.issues,
    });
  }

  try {
    const department = await updateDepartment(
      idValidation.data.id,
      bodyValidation.data,
    );

    if (!department) {
      return sendResponse(res, 404, false, null, {
        message: "Department not found.",
      });
    }

    return sendResponse(res, 200, true, department);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return sendResponse(res, 409, false, null, {
        message: "A department with this name already exists.",
      });
    }

    console.error("Update department error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to update department.",
    });
  }
}

/**
 * Activates or deactivates a department.
 * PATCH /departments/:id/status
 */
export async function updateDepartmentStatusController(
  req: Request,
  res: Response,
) {
  const idValidation = departmentIdSchema.safeParse(req.params);

  if (!idValidation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid department ID.",
      details: idValidation.error.issues,
    });
  }

  const bodyValidation = updateDepartmentStatusSchema.safeParse(req.body);

  if (!bodyValidation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid department status.",
      details: bodyValidation.error.issues,
    });
  }

  try {
    const department = await updateDepartmentStatus(
      idValidation.data.id,
      bodyValidation.data,
    );

    if (!department) {
      return sendResponse(res, 404, false, null, {
        message: "Department not found.",
      });
    }

    return sendResponse(res, 200, true, department);
  } catch (error) {
    console.error("Update department status error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to update department status.",
    });
  }
}
