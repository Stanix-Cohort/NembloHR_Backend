import multer from "multer";
import type { Request, Response, NextFunction } from "express";
import path from "node:path";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const allowedImages: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 2,
  },

  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (file.fieldname === "image") {
      const expectedMimeType = allowedImages[extension];

      if (!expectedMimeType || file.mimetype !== expectedMimeType) {
        return callback(
          new Error("Asset images must be JPG, JPEG, PNG or WEBP."),
        );
      }

      return callback(null, true);
    }

    if (file.fieldname === "file") {
      if (extension !== ".pdf" || file.mimetype !== "application/pdf") {
        return callback(new Error("Supporting documents must be PDF files."));
      }

      return callback(null, true);
    }

    return callback(new Error("Unsupported asset upload field."));
  },
});

const uploadFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

/**
 * Handles optional asset image and supporting document uploads.
 * Files are temporarily stored in memory before Cloudinary upload.
 */
export function uploadAssetFiles(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  uploadFields(req, res, (error) => {
    if (error) {
      const isSizeError =
        error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";

      return res.status(isSizeError ? 413 : 400).json({
        success: false,
        data: null,
        error: {
          message: isSizeError
            ? "An uploaded file exceeds the maximum allowed size of 10 MB."
            : error.message || "Unable to process asset uploads.",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    const files = req.files as
      | Record<string, Express.Multer.File[]>
      | undefined;

    const image = files?.image?.[0];

    if (image && image.size > MAX_IMAGE_SIZE) {
      return res.status(413).json({
        success: false,
        data: null,
        error: {
          message: "Asset images must not exceed 5 MB.",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    next();
  });
}
