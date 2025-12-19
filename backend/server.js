import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import pool from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();

const ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

import authRoutes from "./routes/auth.js";
import drlRoutes from "./routes/drl.js";
import teacherRoutes from "./routes/teacher.js";
import facultyRoutes from "./routes/faculty.js";
import adminRoutes from "./routes/admin.js";
import termRoutes from "./routes/term.js";
import classLeaderRoutes from "./routes/classLeader.js";
import { protectedRoute, requireRole } from "./middlewares/authMiddleware.js";
import autoLockTerm from "./middlewares/autoLockTermMiddleware.js";
import { serveEvidence } from "./controllers/evidenceController.js";


app.get("/", (_req, res) => res.send("DRL API is running.")); // Kiểm tra sức khỏe cơ bản

// Route public để serve file ảnh minh chứng (không cần authentication)
app.get("/api/uploads/evidence/:filename", serveEvidence);

app.use("/api/auth", authRoutes);
app.use(autoLockTerm);
app.use("/api/terms", termRoutes);
app.use("/api/drl", protectedRoute, requireRole('student', 'teacher', 'admin', 'faculty') , drlRoutes);
app.use("/api/teacher",protectedRoute, requireRole('teacher'),teacherRoutes);
app.use("/api/teacher/class-leader", protectedRoute, requireRole('teacher'), classLeaderRoutes);
app.use("/api/class-leader", protectedRoute, requireRole('student'), classLeaderRoutes);
app.use("/api/faculty",protectedRoute, requireRole('faculty') ,facultyRoutes);
app.use("/api/admin", protectedRoute, requireRole('admin'),adminRoutes);


// Thêm route kiểm tra db
app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (e) {
    res
      .status(500)
      .json({ ok: false, database: "disconnected", error: e.message });
  }
});

// Xử lý lỗi
// Xử lý lỗi 404
app.use((_req, res) => res.status(404).json({ error: "not_found" }));

// Xử lý lỗi toàn cục
app.use((err, _req, res, _next) => {
  console.error("LỖI CHƯA XỬ LÝ:", err.stack || err);
  res.status(err.status || 500).json({
    error: err.message || "Bad request",
    // Thêm stack trace nếu ở môi trường phát triển
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

//Khởi động server
const server = app.listen(PORT, () => {
  console.log(`DRL API running at http://localhost:${PORT}`);
  console.log(`Allowing requests from: ${ORIGIN}`);
});

//Tắt server an toàn
process.on("SIGINT", async () => {
  console.log("\nShutting down server...");
  server.close(async () => {
    console.log("Server closed.");
    await pool.end();
    console.log("Database pool closed.");
    process.exit(0);
  });
});

process.on("SIGTERM", async () => {
  console.log("\nSIGTERM received, shutting down gracefully...");
  server.close(async () => {
    console.log("Server closed.");
    await pool.end();
    console.log("Database pool closed.");
    process.exit(0);
  });
});
