import "dotenv/config";

import { prisma } from "../src/database/prisma.js";
import { hashPassword } from "../src/utils/password.js";

async function bootstrapTestEmployee() {
  const username = process.env.TEST_EMPLOYEE_USERNAME?.trim().toLowerCase();
  const password = process.env.TEST_EMPLOYEE_PASSWORD;
  const fullName = process.env.TEST_EMPLOYEE_FULL_NAME?.trim();
  const workEmail = process.env.TEST_EMPLOYEE_EMAIL?.trim().toLowerCase();
  const jobTitle = process.env.TEST_EMPLOYEE_JOB_TITLE?.trim();
  const startDateValue = process.env.TEST_EMPLOYEE_START_DATE;

  // Validate required configuration.
  if (
    !username ||
    !password ||
    !fullName ||
    !workEmail ||
    !jobTitle ||
    !startDateValue
  ) {
    throw new Error(
      "Missing test employee configuration. Check the TEST_EMPLOYEE_* variables in .env.",
    );
  }

  const startDate = new Date(`${startDateValue}T00:00:00.000Z`);

  if (Number.isNaN(startDate.getTime())) {
    throw new Error(
      "TEST_EMPLOYEE_START_DATE must be a valid YYYY-MM-DD date.",
    );
  }

  // Prevent duplicate test accounts.
  const existingUser = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUser) {
    throw new Error(`A user with username "${username}" already exists.`);
  }

  const existingEmployee = await prisma.employee.findUnique({
    where: { workEmail },
  });

  if (existingEmployee) {
    throw new Error(
      `An employee with work email "${workEmail}" already exists.`,
    );
  }

  // Hash the temporary password before storing it.
  const passwordHash = await hashPassword(password);

  // Create the User and linked Employee profile together.
  const employee = await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: "EMPLOYEE",
      mustChangePassword: true,
      employee: {
        create: {
          fullName,
          workEmail,
          jobTitle,
          startDate,
        },
      },
    },
    select: {
      id: true,
      username: true,
      role: true,
      mustChangePassword: true,
      employee: {
        select: {
          id: true,
          fullName: true,
          workEmail: true,
          jobTitle: true,
        },
      },
    },
  });

  console.log("\nTest Employee account created successfully.");
  console.log({
    userId: employee.id,
    username: employee.username,
    role: employee.role,
    mustChangePassword: employee.mustChangePassword,
    employee: employee.employee,
  });

  console.log("\nUse the TEST_EMPLOYEE_PASSWORD value from .env for login.");
}

bootstrapTestEmployee()
  .catch((error) => {
    console.error("Failed to create test Employee:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
