import { Router } from "express";

import {
  createEmployeeController,
  listEmployeesController,
  getEmployeeByIdController,
  getMyEmployeeProfileController,
  updateEmployeeController,
  updateEmployeeStatusController,
  resetEmployeePasswordController,
} from "./employee.controller.js";

import {
  authenticate,
  requirePasswordChangeComplete,
} from "../../middleware/auth.middleware.js";

import { authorize } from "../../middleware/authorize.middleware.js";

const router = Router();

// Employee self-service: retrieve the authenticated employee's own profile.
router.get(
  "/me/profile",
  authenticate,
  authorize("EMPLOYEE"),
  requirePasswordChangeComplete,
  getMyEmployeeProfileController,
);

// All employee-management endpoints require an authenticated Admin.
router.use(authenticate, authorize("ADMIN"));

router.post("/", createEmployeeController);
router.get("/", listEmployeesController);
router.get("/:id", getEmployeeByIdController);
router.patch("/:id", updateEmployeeController);
router.patch("/:id/status", updateEmployeeStatusController);
router.post("/:id/reset-password", resetEmployeePasswordController);

export default router;
