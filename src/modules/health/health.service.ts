import { prisma } from "../../database/prisma.js";

/**
 * Checks whether the application can communicate with PostgreSQL.
 *
 * Throws an error if the database is unavailable.
 */
export async function checkDatabaseConnection(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
