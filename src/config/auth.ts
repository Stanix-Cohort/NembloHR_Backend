import "dotenv/config";

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getPositiveInteger(name: string, defaultValue: number): number {
  const rawValue = process.env[name];

  if (!rawValue) {
    return defaultValue;
  }

  const value = Number(rawValue);

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

const accessTokenSecret = getRequiredEnv("ACCESS_TOKEN_SECRET");

if (!/^[A-Za-z0-9_-]{64}$/.test(accessTokenSecret)) {
  throw new Error(
    "ACCESS_TOKEN_SECRET must be a valid 64-character base64url secret.",
  );
}

export const authConfig = {
  accessTokenSecret,
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "15m",
  refreshTokenTtlDays: getPositiveInteger("REFRESH_TOKEN_TTL_DAYS", 7),
};
