import { prisma } from "../../database/prisma.js";

import type {
  CreateDepartmentInput,
  UpdateDepartmentInput,
  UpdateDepartmentStatusInput,
  // We'll use the list filter type once we export it.
} from "./department.validation.js";

/**
 * Normalises department names for consistent duplicate detection.
 *
 * Example:
 * " Human   Resources " -> "human resources"
 */
function normaliseDepartmentName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Creates a department.
 *
 * The display name is preserved, while normalizedName
 * enforces case- and whitespace-insensitive uniqueness.
 */
export async function createDepartment(input: CreateDepartmentInput) {
  const name = input.name.trim();

  return prisma.department.create({
    data: {
      name,
      normalizedName: normaliseDepartmentName(name),
      description: input.description?.trim() || null,
    },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          employees: true,
        },
      },
    },
  });
}

/**
 * Lists departments for the Admin department directory.
 *
 * Includes active and inactive departments by default.
 * Supports searching by department name and filtering by status.
 */
export async function listDepartments(
  filters: {
    search?: string;
    status?: "all" | "active" | "inactive";
  } = {},
) {
  const { search, status = "all" } = filters;

  return prisma.department.findMany({
    where: {
      ...(status !== "all" && {
        isActive: status === "active",
      }),
      ...(search && {
        name: {
          contains: search,
          mode: "insensitive",
        },
      }),
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          employees: true,
        },
      },
    },
  });
}


/**
 * Retrieves a single department by ID.
 */
export async function getDepartmentById(id: string) {
  return prisma.department.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          employees: true,
        },
      },
    },
  });
}

/**
 * Updates a department's name or description.
 *
 * The normalised name is recalculated whenever the name changes.
 */
export async function updateDepartment(
  id: string,
  input: UpdateDepartmentInput,
) {
  const existingDepartment = await prisma.department.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existingDepartment) {
    return null;
  }

  const name = input.name?.trim();

  return prisma.department.update({
    where: { id },
    data: {
      ...(name !== undefined && {
        name,
        normalizedName: normaliseDepartmentName(name),
      }),
      ...(input.description !== undefined && {
        description: input.description?.trim() || null,
      }),
    },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          employees: true,
        },
      },
    },
  });
}

/**
 * Activates or deactivates a department.
 *
 * Deactivation does not delete the department or affect
 * existing employees assigned to it.
 */
export async function updateDepartmentStatus(
  id: string,
  input: UpdateDepartmentStatusInput,
) {
  const existingDepartment = await prisma.department.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existingDepartment) {
    return null;
  }

  return prisma.department.update({
    where: { id },
    data: {
      isActive: input.isActive,
    },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          employees: true,
        },
      },
    },
  });
}

