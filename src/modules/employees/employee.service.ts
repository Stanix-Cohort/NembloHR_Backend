import { randomInt } from "node:crypto";
import { acquireUserSessionLock } from "../auth/session-lock.js";
import { prisma } from "../../database/prisma.js";
import { hashPassword } from "../../utils/password.js";

import type {
  CreateEmployeeInput,
  ListEmployeesInput,
  UpdateEmployeeInput,
  UpdateEmployeeStatusInput,
} from "./employee.validation.js";

/**
 * Generates a cryptographically secure temporary password.
 *
 * Guarantees at least one uppercase letter, lowercase letter,
 * number and special character.
 */
function generateTemporaryPassword(): string {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const specialCharacters = "!@#$%^&*()-_=+";

  const allCharacters = uppercase + lowercase + numbers + specialCharacters;

  const passwordCharacters = [
    uppercase[randomInt(uppercase.length)]!,
    lowercase[randomInt(lowercase.length)]!,
    numbers[randomInt(numbers.length)]!,
    specialCharacters[randomInt(specialCharacters.length)]!,
  ];

  // Add random characters to reach 24 characters.
  while (passwordCharacters.length < 24) {
    passwordCharacters.push(allCharacters[randomInt(allCharacters.length)]!);
  }

  // Cryptographically shuffle the characters.
  for (let i = passwordCharacters.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);

    [passwordCharacters[i], passwordCharacters[j]] = [
      passwordCharacters[j]!,
      passwordCharacters[i]!,
    ];
  }

  return passwordCharacters.join("");
}

/**
 * Creates an employee account.
 *
 * Generates a temporary password, hashes it using Argon2id,
 * and creates the User and Employee records atomically.
 *
 * The temporary password is returned once to the Admin.
 * It is never stored in plaintext.
 */
export async function createEmployee(input: CreateEmployeeInput) {
  const temporaryPassword = generateTemporaryPassword();

  // Hash the password before opening the database transaction.
  const passwordHash = await hashPassword(temporaryPassword);

  // Convert the date-only input to UTC midnight.
  const startDate = new Date(`${input.startDate}T00:00:00.000Z`);

  return prisma.$transaction(async (tx) => {
    // Verify that the selected department exists and is active.
    const department = await tx.department.findUnique({
      where: {
        id: input.departmentId,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!department) {
      throw new Error("DEPARTMENT_NOT_FOUND");
    }

    if (!department.isActive) {
      throw new Error("DEPARTMENT_INACTIVE");
    }

    // Check whether the work email already belongs to an employee.
    const existingEmployee = await tx.employee.findUnique({
      where: {
        workEmail: input.workEmail,
      },
      select: {
        id: true,
      },
    });

    if (existingEmployee) {
      throw new Error("EMPLOYEE_EMAIL_EXISTS");
    }

    // The work email also serves as the employee's username.
    const existingUser = await tx.user.findUnique({
      where: {
        username: input.workEmail,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new Error("USERNAME_EXISTS");
    }

    // Create the employee's authentication account.
    const user = await tx.user.create({
      data: {
        username: input.workEmail,
        passwordHash,
        role: "EMPLOYEE",
        mustChangePassword: true,
        isActive: true,
      },
      select: {
        id: true,
        username: true,
      },
    });

    // Create the employee's HR profile.
    const employee = await tx.employee.create({
      data: {
        fullName: input.fullName,
        workEmail: input.workEmail,
        phone: input.phone?.trim() || null,
        jobTitle: input.jobTitle,
        startDate,
        employmentStatus: "ACTIVE",
        userId: user.id,
        departmentId: department.id,
      },
      select: {
        id: true,
        fullName: true,
        workEmail: true,
        phone: true,
        jobTitle: true,
        startDate: true,
        employmentStatus: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      employee,
      credentials: {
        username: user.username,
        temporaryPassword,
      },
    };
  });
}

/**
 * Retrieves employees for the employee directory.
 *
 * Supports:
 * - Searching by employee name or work email.
 * - Filtering by department.
 * - Filtering by employment status.
 *
 * Results are ordered alphabetically by employee name.
 */
export async function listEmployees(filters: ListEmployeesInput) {
  const { search, departmentId, status = "all" } = filters;

  return prisma.employee.findMany({
    where: {
      ...(status !== "all" && {
        employmentStatus: status === "active" ? "ACTIVE" : "INACTIVE",
      }),

      ...(departmentId && {
        departmentId,
      }),

      ...(search && {
        OR: [
          {
            fullName: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            workEmail: {
              contains: search,
              mode: "insensitive",
            },
          },
        ],
      }),
    },

    orderBy: {
      fullName: "asc",
    },

    select: {
      id: true,
      fullName: true,
      workEmail: true,
      phone: true,
      jobTitle: true,
      startDate: true,
      employmentStatus: true,
      departmentId: true,

      department: {
        select: {
          id: true,
          name: true,
        },
      },

      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Retrieves an individual employee by ID.
 *
 * Returns null when the employee does not exist.
 * Only safe HR profile fields are selected.
 */
export async function getEmployeeById(id: string) {
  return prisma.employee.findUnique({
    where: {
      id,
    },

    select: {
      id: true,
      fullName: true,
      workEmail: true,
      phone: true,
      jobTitle: true,
      startDate: true,
      employmentStatus: true,
      departmentId: true,

      department: {
        select: {
          id: true,
          name: true,
        },
      },

      createdAt: true,
      updatedAt: true,
    },
  });
}


/**
 * Updates an employee's HR profile.
 *
 * Only supplied fields are updated.
 * If the work email changes, the associated User username
 * is updated within the same transaction.
 */
export async function updateEmployee(
  id: string,
  input: UpdateEmployeeInput,
) {
  return prisma.$transaction(async (tx) => {
    // Find the employee and their associated authentication account.
    const existingEmployee = await tx.employee.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!existingEmployee) {
      throw new Error("EMPLOYEE_NOT_FOUND");
    }

    // Validate a newly selected department.
    if (input.departmentId !== undefined) {
      const department = await tx.department.findUnique({
        where: {
          id: input.departmentId,
        },
        select: {
          id: true,
          isActive: true,
        },
      });

      if (!department) {
        throw new Error("DEPARTMENT_NOT_FOUND");
      }

      if (!department.isActive) {
        throw new Error("DEPARTMENT_INACTIVE");
      }
    }

    // Check whether the new work email belongs to another employee.
    if (input.workEmail !== undefined) {
      const existingEmployeeWithEmail =
        await tx.employee.findUnique({
          where: {
            workEmail: input.workEmail,
          },
          select: {
            id: true,
          },
        });

      if (
        existingEmployeeWithEmail &&
        existingEmployeeWithEmail.id !== id
      ) {
        throw new Error("EMPLOYEE_EMAIL_EXISTS");
      }

      // The work email also serves as the login username.
      const existingUserWithUsername = await tx.user.findUnique({
        where: {
          username: input.workEmail,
        },
        select: {
          id: true,
        },
      });

      if (
        existingUserWithUsername &&
        existingUserWithUsername.id !== existingEmployee.userId
      ) {
        throw new Error("USERNAME_EXISTS");
      }

      // Keep the authentication username synchronised.
      await tx.user.update({
        where: {
          id: existingEmployee.userId,
        },
        data: {
          username: input.workEmail,
        },
      });
    }

    // Build an update containing only the supplied fields.
    const updateData = {
      ...(input.fullName !== undefined && {
        fullName: input.fullName,
      }),

      ...(input.workEmail !== undefined && {
        workEmail: input.workEmail,
      }),

      ...(input.phone !== undefined && {
        phone: input.phone,
      }),

      ...(input.jobTitle !== undefined && {
        jobTitle: input.jobTitle,
      }),

      ...(input.startDate !== undefined && {
        startDate: new Date(`${input.startDate}T00:00:00.000Z`),
      }),

      ...(input.departmentId !== undefined && {
        departmentId: input.departmentId,
      }),
    };

    return tx.employee.update({
      where: {
        id,
      },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        workEmail: true,
        phone: true,
        jobTitle: true,
        startDate: true,
        employmentStatus: true,
        departmentId: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });
  });
}

/**
 * Activates or deactivates an employee account.
 *
 * Keeps Employee.employmentStatus and User.isActive synchronised.
 * Deactivation also revokes all active refresh sessions.
 */
export async function updateEmployeeStatus(
  id: string,
  input: UpdateEmployeeStatusInput,
) {
  return prisma.$transaction(
    async (tx) => {
      // Find the employee and associated user account.
      const existingEmployee = await tx.employee.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          userId: true,
        },
      });

      if (!existingEmployee) {
        throw new Error("EMPLOYEE_NOT_FOUND");
      }

      // Coordinate status changes with login and password operations.
      await acquireUserSessionLock(tx, existingEmployee.userId);

      // Re-read the user after acquiring the lock.
      const user = await tx.user.findUnique({
        where: {
          id: existingEmployee.userId,
        },
        select: {
          id: true,
          role: true,
        },
      });

      if (!user || user.role !== "EMPLOYEE") {
        throw new Error("EMPLOYEE_ACCOUNT_NOT_FOUND");
      }

      const isActive = input.employmentStatus === "ACTIVE";

      // Synchronise the HR and authentication account statuses.
      const employee = await tx.employee.update({
        where: {
          id,
        },
        data: {
          employmentStatus: input.employmentStatus,
        },
        select: {
          id: true,
          fullName: true,
          workEmail: true,
          employmentStatus: true,
          updatedAt: true,
        },
      });

      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          isActive,
        },
      });

      // Revoke every active refresh session when deactivating.
      if (!isActive) {
        await tx.refreshSession.updateMany({
          where: {
            userId: user.id,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        });
      }

      return employee;
    },
    {
      maxWait: 10_000,
      timeout: 10_000,
    },
  );
}
