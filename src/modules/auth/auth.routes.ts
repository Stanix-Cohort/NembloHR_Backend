import { Router } from "express";

// Controllers
import {
  loginController,
  refreshController,
  logoutController,
  changePasswordController,
  getCurrentUserController,
} from "./auth.controller.js";

import {
  adminTestController,
  employeeTestController,
} from "./auth.test.controller.js";

// Middleware
import { authenticate } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { requirePasswordChangeComplete } from "../../middleware/require-password-change-complete.middleware.js";
import {
  loginLimiter,
  refreshLimiter,
  passwordChangeLimiter,
} from "../../middleware/rate-limit.middleware.js";

const router = Router();

// Public authentication routes
router.post("/login", loginLimiter, loginController);
router.post("/refresh", refreshLimiter, refreshController);
router.post("/logout", logoutController);

// Authenticated password management
router.post(
  "/change-password",
  authenticate,
  passwordChangeLimiter,
  changePasswordController,
);

// Authenticated user information
router.get("/me", authenticate, getCurrentUserController);

// Temporary role-based access control test routes
router.get(
  "/admin-test",
  authenticate,
  authorize("ADMIN"),
  adminTestController,
);

router.get(
  "/employee-test",
  authenticate,
  authorize("EMPLOYEE"),
  requirePasswordChangeComplete,
  employeeTestController,
);

export default router;
