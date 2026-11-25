import { Router } from "express";
import { uploadAssetFiles } from "../../middleware/asset-upload.middleware.js";

import {
  authenticate,
  requirePasswordChangeComplete,
} from "../../middleware/auth.middleware.js";

import { authorize } from "../../middleware/authorize.middleware.js";

import {
  createAssetController,
  listAssetsController,
  getAssetByIdController,
  updateAssetController,
  assignAssetController,
  returnAssetController,
  getMyAssetsController,
  createAssetFeedbackController,
  listAssetFeedbackController,
} from "./asset.controller.js";

const router = Router();

/**
 * EMPLOYEE SELF-SERVICE ASSETS
 *
 * Employees can only retrieve their own assigned assets.
 */

router.get(
  "/me",
  authenticate,
  authorize("EMPLOYEE"),
  requirePasswordChangeComplete,
  getMyAssetsController,
);

// Submit feedback about an assigned asset.
router.post(
  "/:id/feedback",
  authenticate,
  authorize("EMPLOYEE"),
  requirePasswordChangeComplete,
  createAssetFeedbackController,
);

/**
 * ADMIN ASSET MANAGEMENT
 *
 * All routes below require Admin authentication.
 */

router.use(authenticate, authorize("ADMIN"), requirePasswordChangeComplete);

// Register a new asset.
router.post("/", uploadAssetFiles, createAssetController);

// Retrieve registered assets with optional filters.
router.get("/", listAssetsController);

// Retrieve employee feedback for Admin review.
router.get("/feedback", listAssetFeedbackController);

// Assign an available asset to an employee.
router.post("/:id/assign", assignAssetController);

// Record the return of an assigned asset.
router.patch("/:id/return", returnAssetController);

// Retrieve one asset and its assignment history.
router.get("/:id", getAssetByIdController);

// Update asset details, condition or permitted status.
router.patch("/:id", uploadAssetFiles, updateAssetController);

export default router;
