import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import apiRoutes from "./routes/index.js";

const app = express();

const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  }),
);

// Request parsing middleware
app.use(express.json());
app.use(cookieParser());

// API routes
app.use("/api/v1", apiRoutes);

export default app;
