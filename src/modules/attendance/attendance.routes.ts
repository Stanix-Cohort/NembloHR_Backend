import { Router } from "express";

import {
  authenticate,
  requirePasswordChangeComplete,
} from "../../middleware/auth.middleware.js";

import { authorize } from "../../middleware/authorize.middleware.js";

import {
  createAttendanceController,
  listAttendanceController,
  getAttendanceByIdController,
  updateAttendanceController,
  clockInEmployeeController,
  clockOutEmployeeController,
  getMyTodayAttendanceController,
  getMyAttendanceHistoryController,
} from "./attendance.controller.js";

const router = Router();

/**
 * EMPLOYEE SELF-SERVICE ATTENDANCE
 *
 * These routes must come before the Admin-only middleware.
 */

// Employee clock-in.
router.post(
  "/clock-in",
  authenticate,
  authorize("EMPLOYEE"),
  requirePasswordChangeComplete,
  clockInEmployeeController,
);

// Employee clock-out.
router.patch(
  "/clock-out",
  authenticate,
  authorize("EMPLOYEE"),
  requirePasswordChangeComplete,
  clockOutEmployeeController,
);

// Retrieve today's attendance.
router.get(
  "/me/today",
  authenticate,
  authorize("EMPLOYEE"),
  requirePasswordChangeComplete,
  getMyTodayAttendanceController,
);

// Retrieve personal attendance history.
router.get(
  "/me",
  authenticate,
  authorize("EMPLOYEE"),
  requirePasswordChangeComplete,
  getMyAttendanceHistoryController,
);

/**
 * ADMIN ATTENDANCE MANAGEMENT
 *
 * All routes below require Admin authentication.
 */

router.use(authenticate, authorize("ADMIN"));

// Create an attendance record.
router.post("/", createAttendanceController);

// Retrieve attendance records with optional filters.
router.get("/", listAttendanceController);

// Retrieve one attendance record.
router.get("/:id", getAttendanceByIdController);

// Correct an existing attendance record.
router.patch("/:id", updateAttendanceController);

export default router;
