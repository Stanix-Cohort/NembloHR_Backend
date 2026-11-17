import "dotenv/config";

import app from "./app.js";
import { prisma } from "./database/prisma.js";

const PORT = Number(process.env.PORT) || 5000;

// Start the application only after the database is available.
async function startServer() {
  try {
    await prisma.$connect();

    console.log("Database connection established successfully.");

    const server = app.listen(PORT, () => {
      console.log(`Nemblo HR API is running on http://localhost:${PORT}`);
      console.log(`Liveness: http://localhost:${PORT}/api/v1/health/live`);
      console.log(`Readiness: http://localhost:${PORT}/api/v1/health/ready`);
    });

    // Prevent multiple shutdown operations from running simultaneously.
    let isShuttingDown = false;

    async function shutdown(signal: NodeJS.Signals) {
      if (isShuttingDown) return;

      isShuttingDown = true;

      console.log(`\n${signal} received. Shutting down gracefully...`);

      try {
        // Stop accepting new connections and wait for active requests.
        await new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });

        // Disconnect Prisma after the HTTP server has closed.
        await prisma.$disconnect();

        console.log("Database connection closed.");
        console.log("Server shut down successfully.");
      } catch (error) {
        console.error("Error during server shutdown:", error);
        process.exitCode = 1;
      }
    }

    // Handle normal process termination signals.
    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (error) {
    console.error("Failed to start Nemblo HR API:", error);

    await prisma.$disconnect().catch((disconnectError) => {
      console.error("Failed to disconnect Prisma:", disconnectError);
    });

    process.exitCode = 1;
  }
}

startServer();
