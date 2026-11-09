import express from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();

// Security and request middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// API health check
app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      service: "Nemblo HR API",
      status: "healthy",
    },
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

export default app;
