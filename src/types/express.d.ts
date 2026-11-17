import type { UserRole } from "../generated/prisma/client.js";

export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: UserRole;
        mustChangePassword: boolean;
        sessionId: string;
      };
    }
  }
}
