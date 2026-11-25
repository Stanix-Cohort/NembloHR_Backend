import type { Request, Response } from "express";

import {
  createAsset,
  listAssets,
  getAssetById,
  updateAsset,
  assignAsset,
  returnAsset,
  getMyAssets,
  createAssetFeedback,
  listAssetFeedback,
} from "./asset.service.js";

import {
  createAssetSchema,
  listAssetsSchema,
  assetIdSchema,
  updateAssetSchema,
  assignAssetSchema,
  createAssetFeedbackSchema,
  listAssetFeedbackSchema,
} from "./asset.validation.js";

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
 * Registers a new asset.
 * POST /assets
 */
export async function createAssetController(req: Request, res: Response) {
  const validation = createAssetSchema.safeParse(req.body);

  if (!validation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid asset information.",
      details: validation.error.issues,
    });
  }

  try {
    const asset = await createAsset(validation.data);

    return sendResponse(res, 201, true, asset);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return sendResponse(res, 409, false, null, {
        message: "An asset with this Asset ID already exists.",
      });
    }

    console.error("Create asset error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to register asset.",
    });
  }
}

/**
 * Retrieves registered assets.
 * GET /assets
 */
export async function listAssetsController(req: Request, res: Response) {
  const validation = listAssetsSchema.safeParse(req.query);

  if (!validation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid asset filters.",
      details: validation.error.issues,
    });
  }

  try {
    const assets = await listAssets(validation.data);

    return sendResponse(res, 200, true, assets);
  } catch (error) {
    console.error("List assets error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to retrieve assets.",
    });
  }
}

/**
 * Retrieves an individual asset and its assignment history.
 * GET /assets/:id
 */
export async function getAssetByIdController(req: Request, res: Response) {
  const validation = assetIdSchema.safeParse(req.params);

  if (!validation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid asset ID.",
      details: validation.error.issues,
    });
  }

  try {
    const asset = await getAssetById(validation.data.id);

    if (!asset) {
      return sendResponse(res, 404, false, null, {
        message: "Asset not found.",
      });
    }

    return sendResponse(res, 200, true, asset);
  } catch (error) {
    console.error("Get asset error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to retrieve asset.",
    });
  }
}

/**
 * Updates asset details, condition or permitted status.
 * PATCH /assets/:id
 */
export async function updateAssetController(req: Request, res: Response) {
  const paramsValidation = assetIdSchema.safeParse(req.params);

  if (!paramsValidation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid asset ID.",
      details: paramsValidation.error.issues,
    });
  }

  const bodyValidation = updateAssetSchema.safeParse(req.body);

  if (!bodyValidation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid asset update information.",
      details: bodyValidation.error.issues,
    });
  }

  try {
    const asset = await updateAsset(
      paramsValidation.data.id,
      bodyValidation.data,
    );

    return sendResponse(res, 200, true, asset);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "ASSET_NOT_FOUND":
          return sendResponse(res, 404, false, null, {
            message: "Asset not found.",
          });

        case "USE_ASSIGNMENT_ENDPOINT":
          return sendResponse(res, 400, false, null, {
            message: "Use the asset assignment operation to assign an asset.",
          });

        case "ASSET_MUST_BE_RETURNED_FIRST":
          return sendResponse(res, 409, false, null, {
            message:
              "An assigned asset must be returned before its status can be changed.",
          });
      }
    }

    console.error("Update asset error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to update asset.",
    });
  }
}


/**
 * Assigns an available asset to an employee.
 * POST /assets/:id/assign
 */
export async function assignAssetController(req: Request, res: Response) {
  const paramsValidation = assetIdSchema.safeParse(req.params);

  if (!paramsValidation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid asset ID.",
      details: paramsValidation.error.issues,
    });
  }

  const bodyValidation = assignAssetSchema.safeParse(req.body);

  if (!bodyValidation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid asset assignment information.",
      details: bodyValidation.error.issues,
    });
  }

  try {
    const assignedById = req.user?.id;

    if (!assignedById) {
      return sendResponse(res, 401, false, null, {
        message: "Authentication is required to assign an asset.",
      });
    }

    const assignment = await assignAsset(
      paramsValidation.data.id,
      bodyValidation.data,
      assignedById
    );

    return sendResponse(res, 201, true, assignment);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "EMPLOYEE_NOT_FOUND":
          return sendResponse(res, 404, false, null, {
            message: "The selected employee does not exist.",
          });

        case "EMPLOYEE_INACTIVE":
          return sendResponse(res, 403, false, null, {
            message: "Inactive employees cannot receive assets.",
          });

        case "ASSET_NOT_FOUND":
          return sendResponse(res, 404, false, null, {
            message: "Asset not found.",
          });

        case "ASSET_NOT_AVAILABLE":
          return sendResponse(res, 409, false, null, {
            message: "This asset is not available for assignment.",
          });
      }
    }

    console.error("Assign asset error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to assign asset.",
    });
  }
}


/**
 * Records the return of an assigned asset.
 * PATCH /assets/:id/return
 */
export async function returnAssetController(req: Request, res: Response) {
  const validation = assetIdSchema.safeParse(req.params);

  if (!validation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid asset ID.",
      details: validation.error.issues,
    });
  }

  try {
    const returnedById = req.user?.id;

    if (!returnedById) {
      return sendResponse(res, 401, false, null, {
        message: "Authentication is required to record an asset return.",
      });
    }

    const assignment = await returnAsset(
      validation.data.id,
      returnedById
    );

    return sendResponse(res, 200, true, assignment);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "ASSET_NOT_FOUND":
          return sendResponse(res, 404, false, null, {
            message: "Asset not found.",
          });

        case "ASSET_NOT_ASSIGNED":
          return sendResponse(res, 409, false, null, {
            message: "This asset is not currently assigned.",
          });

        case "ACTIVE_ASSIGNMENT_NOT_FOUND":
          return sendResponse(res, 409, false, null, {
            message: "No active assignment was found for this asset.",
          });

        case "ASSIGNMENT_ALREADY_RETURNED":
          return sendResponse(res, 409, false, null, {
            message: "This assignment has already been returned.",
          });

        case "ASSET_STATUS_UPDATE_FAILED":
          return sendResponse(res, 409, false, null, {
            message: "Unable to update the asset status.",
          });
      }
    }

    console.error("Return asset error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to record asset return.",
    });
  }
}


/**
 * Retrieves assets assigned to the authenticated employee.
 * GET /assets/me
 */
export async function getMyAssetsController(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendResponse(res, 401, false, null, {
        message: "Authentication is required to retrieve your assets.",
      });
    }

    const assets = await getMyAssets(userId);

    return sendResponse(res, 200, true, assets);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "EMPLOYEE_NOT_FOUND":
          return sendResponse(res, 404, false, null, {
            message: "Employee account not found.",
          });

        case "EMPLOYEE_INACTIVE":
          return sendResponse(res, 403, false, null, {
            message: "Inactive employees cannot access assigned assets.",
          });
      }
    }

    console.error("Get employee assets error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to retrieve your assigned assets.",
    });
  }
}


/**
 * Allows an employee to submit feedback about an assigned asset.
 * POST /assets/:id/feedback
 */
export async function createAssetFeedbackController(
  req: Request,
  res: Response
) {
  const paramsValidation = assetIdSchema.safeParse(req.params);

  if (!paramsValidation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid asset ID.",
      details: paramsValidation.error.issues,
    });
  }

  const bodyValidation = createAssetFeedbackSchema.safeParse(req.body);

  if (!bodyValidation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid asset feedback information.",
      details: bodyValidation.error.issues,
    });
  }

  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendResponse(res, 401, false, null, {
        message: "Authentication is required to submit asset feedback.",
      });
    }

    const feedback = await createAssetFeedback(
      paramsValidation.data.id,
      userId,
      bodyValidation.data
    );

    return sendResponse(res, 201, true, feedback);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "EMPLOYEE_NOT_FOUND":
          return sendResponse(res, 404, false, null, {
            message: "Employee account not found.",
          });

        case "EMPLOYEE_INACTIVE":
          return sendResponse(res, 403, false, null, {
            message: "Inactive employees cannot submit asset feedback.",
          });

        case "ASSET_NOT_ASSIGNED_TO_EMPLOYEE":
          return sendResponse(res, 403, false, null, {
            message:
              "You can only submit feedback for assets currently assigned to you.",
          });
      }
    }

    console.error("Create asset feedback error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to submit asset feedback.",
    });
  }
}


/**
 * Retrieves asset feedback for Admin review.
 * GET /assets/feedback
 */
export async function listAssetFeedbackController(
  req: Request,
  res: Response
) {
  const validation = listAssetFeedbackSchema.safeParse(req.query);

  if (!validation.success) {
    return sendResponse(res, 400, false, null, {
      message: "Invalid asset feedback filters.",
      details: validation.error.issues,
    });
  }

  try {
    const feedback = await listAssetFeedback(validation.data);

    return sendResponse(res, 200, true, feedback);
  } catch (error) {
    console.error("List asset feedback error:", error);

    return sendResponse(res, 500, false, null, {
      message: "Unable to retrieve asset feedback.",
    });
  }
}
