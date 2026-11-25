import { randomUUID } from "node:crypto";
import path from "node:path";

import cloudinary, { cloudinaryConfigured } from "../config/cloudinary.js";

type CloudinaryResourceType = "image" | "raw";

interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

/**
 * Uploads an asset image or supporting document to Cloudinary.
 *
 * Images use the image resource type.
 * PDF documents use the raw resource type.
 */
export function uploadAssetToCloudinary(
  file: Express.Multer.File,
  resourceType: CloudinaryResourceType,
): Promise<CloudinaryUploadResult> {
  if (!cloudinaryConfigured) {
    throw new Error("CLOUDINARY_NOT_CONFIGURED");
  }

  const extension = path.extname(file.originalname).toLowerCase();

  const publicId =
    resourceType === "raw" ? `${randomUUID()}${extension}` : randomUUID();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "nemblohr/assets",
        resource_type: resourceType,
        public_id: publicId,
      },
      (error, result) => {
        if (error || !result) {
          return reject(error ?? new Error("CLOUDINARY_UPLOAD_FAILED"));
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      },
    );

    uploadStream.end(file.buffer);
  });
}


/**
 * Deletes an uploaded asset file from Cloudinary.
 *
 * Used to clean up uploads when a subsequent database operation fails.
 */
export async function deleteAssetFromCloudinary(
  publicId: string,
  resourceType: CloudinaryResourceType,
): Promise<void> {
  if (!cloudinaryConfigured) {
    throw new Error("CLOUDINARY_NOT_CONFIGURED");
  }

  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    type: "upload",
  });

  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error("CLOUDINARY_DELETE_FAILED");
  }
}
