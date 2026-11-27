import { prisma } from "../../database/prisma.js";

import type {
  CreateAssetInput,
  ListAssetsInput,
  UpdateAssetInput,
  AssignAssetInput,
  CreateAssetFeedbackInput,
  ListAssetFeedbackInput,
} from "./asset.validation.js";

export type AssetUploadData = {
  image?: {
    url: string;
    publicId: string;
  };
  file?: {
    url: string;
    publicId: string;
  };
};

/**
 * Registers a new asset.
 *
 * Asset IDs are unique at database level.
 * Image and file uploads are optional and handled separately.
 */
export async function createAsset(
  input: CreateAssetInput,
  uploads?: AssetUploadData,
) {
  return prisma.asset.create({
    data: {
      assetId: input.assetId,
      name: input.name,
      type: input.type,
      serialNumber: input.serialNumber?.trim() || null,
      condition: input.condition,
      description: input.description?.trim() || null,
      imageUrl: uploads?.image?.url ?? null,
      imagePublicId: uploads?.image?.publicId ?? null,
      fileUrl: uploads?.file?.url ?? null,
      filePublicId: uploads?.file?.publicId ?? null,
    },

    select: {
      id: true,
      assetId: true,
      name: true,
      type: true,
      serialNumber: true,
      condition: true,
      status: true,
      description: true,
      imageUrl: true,
      fileUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Retrieves registered assets.
 *
 * Supports filtering by:
 * - Asset name, Asset ID or serial number.
 * - Asset type.
 * - Asset status.
 * - Asset condition.
 */

export async function listAssets(filters: ListAssetsInput) {
  const { search, type, status = "all", condition = "all" } = filters;

  const assets = await prisma.asset.findMany({
    where: {
      ...(search && {
        OR: [
          {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            assetId: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            serialNumber: {
              contains: search,
              mode: "insensitive",
            },
          },
        ],
      }),

      ...(type && {
        type: {
          equals: type,
          mode: "insensitive",
        },
      }),

      ...(status !== "all" && {
        status,
      }),

      ...(condition !== "all" && {
        condition,
      }),
    },

    orderBy: [
      {
        createdAt: "desc",
      },
      {
        name: "asc",
      },
    ],

    select: {
      id: true,
      assetId: true,
      name: true,
      type: true,
      serialNumber: true,
      condition: true,
      status: true,
      description: true,
      imageUrl: true,
      fileUrl: true,

      // Latest active assignment and assigned employee
      assignments: {
        where: {
          returnedAt: null,
        },
        orderBy: {
          assignedAt: "desc",
        },
        take: 1,
        select: {
          employee: {
            select: {
              id: true,
              fullName: true,
              workEmail: true,
            },
          },
        },
      },

      feedback: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          condition: true,
          createdAt: true,
        },
      },

      createdAt: true,
      updatedAt: true,
    },
  });

  return assets.map(({ feedback, assignments, ...asset }) => {
    const latestFeedback = feedback[0] ?? null;

    return {
      ...asset,

      assignedTo: assignments[0]?.employee ?? null,

      hasReportedIssue:
        latestFeedback?.condition === "POOR" ||
        latestFeedback?.condition === "DAMAGED",

      latestFeedback,
    };
  });
}

/**
 * Retrieves one asset by its database ID,
 * including its assignment history.
 */
export async function getAssetById(id: string) {
  const asset = await prisma.asset.findUnique({
    where: { id },

    select: {
      id: true,
      assetId: true,
      name: true,
      type: true,
      serialNumber: true,
      condition: true,
      status: true,
      description: true,
      imageUrl: true,
      fileUrl: true,
      createdAt: true,
      updatedAt: true,

      feedback: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          condition: true,
          comment: true,
          createdAt: true,
          employee: {
            select: {
              id: true,
              fullName: true,
              workEmail: true,
            },
          },
        },
      },

      assignments: {
        orderBy: {
          assignedAt: "desc",
        },
        select: {
          id: true,
          assignedAt: true,
          returnedAt: true,

          employee: {
            select: {
              id: true,
              fullName: true,
              workEmail: true,
            },
          },

          assignedBy: {
            select: {
              id: true,
              username: true,
            },
          },

          returnedBy: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
    },
  });

  if (!asset) {
    return null;
  }

  const { feedback, ...assetDetails } = asset;
  const latestFeedback = feedback[0] ?? null;

  return {
    ...assetDetails,
    hasReportedIssue:
      latestFeedback?.condition === "POOR" ||
      latestFeedback?.condition === "DAMAGED",
    latestFeedback,
  };
}

/**
 * Updates asset details, condition and permitted status changes.
 *
 * Assignment and return status transitions must use their
 * dedicated operations to preserve assignment history.
 */
export async function updateAsset(
  id: string,
  input: UpdateAssetInput,
  uploads?: AssetUploadData,
) {
  return prisma.$transaction(async (tx) => {
    const existingAsset = await tx.asset.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        imagePublicId: true,
        filePublicId: true,
      },
    });
    if (!existingAsset) {
      throw new Error("ASSET_NOT_FOUND");
    }

    if (input.status === "ASSIGNED") {
      throw new Error("USE_ASSIGNMENT_ENDPOINT");
    }

    if (existingAsset.status === "ASSIGNED" && input.status !== undefined) {
      throw new Error("ASSET_MUST_BE_RETURNED_FIRST");
    }

    const updatedAsset = await tx.asset.update({
      where: { id },

      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.serialNumber !== undefined && {
          serialNumber: input.serialNumber,
        }),
        ...(input.condition !== undefined && {
          condition: input.condition,
        }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.status !== undefined && {
          status: input.status,
        }),
        ...(uploads?.image && {
          imageUrl: uploads.image.url,
          imagePublicId: uploads.image.publicId,
        }),

        ...(uploads?.file && {
          fileUrl: uploads.file.url,
          filePublicId: uploads.file.publicId,
        }),
      },

      select: {
        id: true,
        assetId: true,
        name: true,
        type: true,
        serialNumber: true,
        condition: true,
        status: true,
        description: true,
        imageUrl: true,
        fileUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      asset: updatedAsset,
      previousUploads: {
        imagePublicId: uploads?.image ? existingAsset.imagePublicId : null,

        filePublicId: uploads?.file ? existingAsset.filePublicId : null,
      },
    };
  });
}

/**
 * Assigns an available asset to an active employee.
 *
 * The asset status and assignment record are updated
 * within one transaction.
 */
export async function assignAsset(
  assetId: string,
  input: AssignAssetInput,
  assignedById: string,
) {
  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findUnique({
      where: { id: input.employeeId },
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

    const asset = await tx.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!asset) {
      throw new Error("ASSET_NOT_FOUND");
    }

    if (asset.status !== "AVAILABLE") {
      throw new Error("ASSET_NOT_AVAILABLE");
    }

    // Conditional update prevents simultaneous assignments.
    const updatedAsset = await tx.asset.updateMany({
      where: {
        id: assetId,
        status: "AVAILABLE",
      },
      data: {
        status: "ASSIGNED",
      },
    });

    if (updatedAsset.count !== 1) {
      throw new Error("ASSET_NOT_AVAILABLE");
    }

    return tx.assetAssignment.create({
      data: {
        assetId,
        employeeId: input.employeeId,
        assignedById,
      },
      select: {
        id: true,
        assetId: true,
        employeeId: true,
        assignedAt: true,
        returnedAt: true,
        employee: {
          select: {
            id: true,
            fullName: true,
            workEmail: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  });
}

/**
 * Records the return of an assigned asset.
 *
 * Preserves the original assignment record and updates
 * the asset status back to AVAILABLE.
 */
export async function returnAsset(assetId: string, returnedById: string) {
  return prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!asset) {
      throw new Error("ASSET_NOT_FOUND");
    }

    if (asset.status !== "ASSIGNED") {
      throw new Error("ASSET_NOT_ASSIGNED");
    }

    const activeAssignment = await tx.assetAssignment.findFirst({
      where: {
        assetId,
        returnedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!activeAssignment) {
      throw new Error("ACTIVE_ASSIGNMENT_NOT_FOUND");
    }

    const returnedAt = new Date();

    const updatedAssignment = await tx.assetAssignment.updateMany({
      where: {
        id: activeAssignment.id,
        returnedAt: null,
      },
      data: {
        returnedAt,
        returnedById,
      },
    });

    if (updatedAssignment.count !== 1) {
      throw new Error("ASSIGNMENT_ALREADY_RETURNED");
    }

    const updatedAsset = await tx.asset.updateMany({
      where: {
        id: assetId,
        status: "ASSIGNED",
      },
      data: {
        status: "AVAILABLE",
      },
    });

    if (updatedAsset.count !== 1) {
      throw new Error("ASSET_STATUS_UPDATE_FAILED");
    }

    return tx.assetAssignment.findUnique({
      where: {
        id: activeAssignment.id,
      },
      select: {
        id: true,
        assetId: true,
        employeeId: true,
        assignedAt: true,
        returnedAt: true,
        employee: {
          select: {
            id: true,
            fullName: true,
            workEmail: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            username: true,
          },
        },
        returnedBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  });
}

/**
 * Retrieves assets currently assigned to the authenticated employee.
 *
 * The employee record is derived from the authenticated User ID.
 * Only active assignments are returned.
 */
export async function getMyAssets(userId: string) {
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

  return prisma.assetAssignment.findMany({
    where: {
      employeeId: employee.id,
      returnedAt: null,
    },

    orderBy: {
      assignedAt: "desc",
    },

    select: {
      id: true,
      assignedAt: true,

      asset: {
        select: {
          id: true,
          assetId: true,
          name: true,
          type: true,
          serialNumber: true,
          condition: true,
          status: true,
          description: true,
          imageUrl: true,
        },
      },
    },
  });
}

/**
 * Allows an employee to submit feedback about an assigned asset.
 *
 * Each submission creates a new feedback record.
 * Previous feedback is never overwritten.
 */
export async function createAssetFeedback(
  assetId: string,
  userId: string,
  input: CreateAssetFeedbackInput,
) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
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

  const activeAssignment = await prisma.assetAssignment.findFirst({
    where: {
      assetId,
      employeeId: employee.id,
      returnedAt: null,
    },
    select: {
      id: true,
      assetId: true,
      employeeId: true,
    },
  });

  if (!activeAssignment) {
    throw new Error("ASSET_NOT_ASSIGNED_TO_EMPLOYEE");
  }

  return prisma.assetFeedback.create({
    data: {
      assetId: activeAssignment.assetId,
      assignmentId: activeAssignment.id,
      employeeId: employee.id,
      condition: input.condition,
      comment: input.comment,
    },
    select: {
      id: true,
      condition: true,
      comment: true,
      createdAt: true,
      asset: {
        select: {
          id: true,
          assetId: true,
          name: true,
          type: true,
        },
      },
    },
  });
}

/**
 * Retrieves asset feedback for Admin review.
 *
 * Supports filtering by asset and employee.
 * Newest feedback entries appear first.
 */
export async function listAssetFeedback(filters: ListAssetFeedbackInput) {
  const { assetId, employeeId } = filters;

  return prisma.assetFeedback.findMany({
    where: {
      ...(assetId && { assetId }),
      ...(employeeId && { employeeId }),
    },

    orderBy: {
      createdAt: "desc",
    },

    select: {
      id: true,
      condition: true,
      comment: true,
      createdAt: true,

      employee: {
        select: {
          id: true,
          fullName: true,
          workEmail: true,
        },
      },

      asset: {
        select: {
          id: true,
          assetId: true,
          name: true,
          type: true,
          serialNumber: true,
          condition: true,
          status: true,
        },
      },

      assignment: {
        select: {
          assignedAt: true,
          returnedAt: true,
        },
      },
    },
  });
}
