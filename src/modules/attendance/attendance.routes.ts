import { Router } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";

import {
  createAttendanceController,
  listAttendanceController,
  getAttendanceByIdController,
  updateAttendanceController,
} from "./attendance.controller.js";

const router = Router();

// All attendance endpoints require Admin authentication.
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
