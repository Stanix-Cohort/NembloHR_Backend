import { Router } from "express";
import healthRoutes from "../modules/health/health.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";
import departmentRoutes from "../modules/departments/department.routes.js";
import employeeRoutes from "../modules/employees/employee.routes.js";
import attendanceRoutes from "../modules/attendance/attendance.routes.js";
import assetRoutes from "../modules/assets/asset.routes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/departments", departmentRoutes);
router.use("/employees", employeeRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/assets", assetRoutes);

export default router;
