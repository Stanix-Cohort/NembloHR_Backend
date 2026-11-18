import { SignJWT, jwtVerify } from "jose";
import { authConfig } from "../config/auth.js";
import type { UserRole } from "../generated/prisma/client.js";

const secretKey = new TextEncoder().encode(authConfig.accessTokenSecret);

export interface AccessTokenPayload {
  userId: string;
  username: string;
  role: UserRole;
  sessionId: string;
}

export async function generateAccessToken(
  payload: AccessTokenPayload,
): Promise<string> {
  return new SignJWT({
    username: payload.username,
    role: payload.role,
    sessionId: payload.sessionId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(authConfig.accessTokenTtl)
    .sign(secretKey);
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, secretKey, {
    algorithms: ["HS256"],
  });

  if (
    typeof payload.sub !== "string" ||
    typeof payload.username !== "string" ||
    typeof payload.sessionId !== "string" ||
    (payload.role !== "ADMIN" && payload.role !== "EMPLOYEE")
  ) {
    throw new Error("Invalid access token payload.");
  }

  return {
    userId: payload.sub,
    username: payload.username,
    role: payload.role,
    sessionId: payload.sessionId,
  };
}
