import { Router } from "express";

import {
  createEmployeeController,
  listEmployeesController,
  getEmployeeByIdController,
  updateEmployeeController,
  updateEmployeeStatusController,
} from "./employee.controller.js";

import { authenticate } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";

const router = Router();

// All employee-management endpoints require an authenticated Admin.
router.use(authenticate, authorize("ADMIN"));

router.post("/", createEmployeeController);
router.get("/", listEmployeesController);
router.get("/:id", getEmployeeByIdController);
router.patch("/:id", updateEmployeeController);
router.patch("/:id/status", updateEmployeeStatusController);

export default router;
