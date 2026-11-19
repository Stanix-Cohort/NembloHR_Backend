import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import apiRoutes from "./routes/index.js";

const app = express();

const allowedOrigins: string[] = [
  "http://localhost:5173",
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
];

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// Request parsing middleware
app.use(express.json());
app.use(cookieParser());

// API routes
app.use("/api/v1", apiRoutes);

export default app;
