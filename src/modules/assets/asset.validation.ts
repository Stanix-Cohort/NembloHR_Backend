import { z } from "zod";

// ASSET ENUMS

const assetStatuses = [
  "AVAILABLE",
  "ASSIGNED",
  "UNDER_REPAIR",
  "LOST",
  "RETIRED",
] as const;

const assetConditions = ["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"] as const;

// ASSET ID

export const assetIdSchema = z.object({
  id: z.string().trim().min(1, "Asset ID is required."),
});

// CREATE ASSET

export const createAssetSchema = z.object({
  assetId: z
    .string()
    .trim()
    .min(1, "Asset ID is required.")
    .max(100, "Asset ID must not exceed 100 characters."),

  name: z
    .string()
    .trim()
    .min(1, "Asset name is required.")
    .max(150, "Asset name must not exceed 150 characters."),

  type: z
    .string()
    .trim()
    .min(1, "Asset type is required.")
    .max(100, "Asset type must not exceed 100 characters."),

  serialNumber: z
    .string()
    .trim()
    .max(150, "Serial number must not exceed 150 characters.")
    .nullable()
    .optional(),

  condition: z.enum(assetConditions).default("GOOD"),

  description: z
    .string()
    .trim()
    .max(2000, "Description must not exceed 2000 characters.")
    .nullable()
    .optional(),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;

// UPDATE ASSET

export const updateAssetSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),

    type: z.string().trim().min(1).max(100).optional(),

    serialNumber: z.string().trim().max(150).nullable().optional(),

    condition: z.enum(assetConditions).optional(),

    description: z.string().trim().max(2000).nullable().optional(),

    status: z.enum(assetStatuses).optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field must be provided for an update.",
  );

export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;

// LIST ASSETS

export const listAssetsSchema = z.object({
  search: z.string().trim().optional(),

  type: z.string().trim().optional(),

  status: z.enum(["all", ...assetStatuses]).default("all"),

  condition: z.enum(["all", ...assetConditions]).default("all"),
});

export type ListAssetsInput = z.infer<typeof listAssetsSchema>;

// ASSIGN ASSET

export const assignAssetSchema = z.object({
  employeeId: z.string().trim().min(1, "Employee ID is required."),
});

export type AssignAssetInput = z.infer<typeof assignAssetSchema>;

// ASSET FEEDBACK

export const createAssetFeedbackSchema = z.object({
  condition: z.enum(assetConditions),

  comment: z
    .string()
    .trim()
    .min(1, "Feedback comment is required.")
    .max(2000, "Feedback comment must not exceed 2000 characters."),
});

export type CreateAssetFeedbackInput = z.infer<
  typeof createAssetFeedbackSchema
>;

// FEEDBACK LIST FILTERS

export const listAssetFeedbackSchema = z.object({
  assetId: z.string().trim().min(1).optional(),

  employeeId: z.string().trim().min(1).optional(),
});

export type ListAssetFeedbackInput = z.infer<typeof listAssetFeedbackSchema>;