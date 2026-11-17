import "dotenv/config";

import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client.js";

// Ensure the pooled database URL is available.
const connectionString = process.env.DATABASE_POOL_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_POOL_URL is not defined in the environment variables.",
  );
}

// Initialise the Neon driver adapter.
const adapter = new PrismaNeon({
  connectionString,
});

// Create a single Prisma Client instance for the application.
export const prisma = new PrismaClient({
  adapter,
});
