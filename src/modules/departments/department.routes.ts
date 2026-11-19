import { Router } from "express";

import {
  createDepartmentController,
  listDepartmentsController,
  getDepartmentController,
  updateDepartmentController,
  updateDepartmentStatusController,
} from "./department.controller.js";

import { authenticate } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";

const router = Router();

// All department-management endpoints require an authenticated Admin.
router.use(authenticate, authorize("ADMIN"));

router.post("/", createDepartmentController);

router.get("/", listDepartmentsController);

router.get("/:id", getDepartmentController);

router.patch("/:id", updateDepartmentController);

router.patch("/:id/status", updateDepartmentStatusController);

export default router;
