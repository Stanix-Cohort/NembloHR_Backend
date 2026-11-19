import { randomInt } from "node:crypto";

import { prisma } from "../../database/prisma.js";
import { hashPassword } from "../../utils/password.js";

import type {
  CreateEmployeeInput,
  ListEmployeesInput,
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