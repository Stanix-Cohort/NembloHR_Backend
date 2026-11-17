/// <reference types="node" />

import "dotenv/config";

import { prisma } from "../src/database/prisma.js";
import { hashPassword } from "../src/utils/password.js";

async function bootstrapAdmin() {
  try {
    const username = process.env.INITIAL_ADMIN_USERNAME?.trim().toLowerCase();
    const password = process.env.INITIAL_ADMIN_PASSWORD;

    // Ensure the required environment variables exist.
    if (!username || !password) {
      throw new Error(
        "INITIAL_ADMIN_USERNAME and INITIAL_ADMIN_PASSWORD must be configured.",
      );
    }

    // Refuse to create another Admin if one already exists.
    const existingAdmin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });

    if (existingAdmin) {
      throw new Error("An Admin account already exists. Bootstrap cancelled.");
    }

    // Ensure the username is not already taken.
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      throw new Error("The configured Admin username is already in use.");
    }

    // Hash the password before storing it.
    const passwordHash = await hashPassword(password);

    await prisma.user.create({
      data: {
        username,
        passwordHash,
        role: "ADMIN",
        mustChangePassword: true,
        isActive: true,
      },
    });

    console.log("Initial Admin account created successfully.");
    console.log("The Admin must change their password at first login.");
  } catch (error) {
    console.error("Admin bootstrap failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

bootstrapAdmin();
