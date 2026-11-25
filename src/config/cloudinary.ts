import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

const credentials = [cloudName, apiKey, apiSecret];

const configuredCredentials = credentials.filter(Boolean).length;

if (configuredCredentials > 0 && configuredCredentials < 3) {
  throw new Error(
    "Cloudinary configuration is incomplete. Provide all three Cloudinary environment variables.",
  );
}

export const cloudinaryConfigured = configuredCredentials === 3;

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

export default cloudinary;
