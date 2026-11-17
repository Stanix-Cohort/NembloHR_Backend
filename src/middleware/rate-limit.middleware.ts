import { rateLimit } from "express-rate-limit";

/**
 * Limits repeated login attempts from the same IP address.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: {
      code: "LOGIN_RATE_LIMITED",
      message: "Too many login attempts. Please try again later.",
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  },
});

/**
 * Limits excessive refresh-token requests.
 */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: {
      code: "REFRESH_RATE_LIMITED",
      message: "Too many refresh requests. Please try again later.",
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  },
});

/**
 * Limits repeated password-change requests.
 */
export const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: {
      code: "PASSWORD_CHANGE_RATE_LIMITED",
      message: "Too many password-change requests. Please try again later.",
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  },
});
