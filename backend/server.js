import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import pool from './db.js';
import { setDbConfig } from "./utils/helpers.js";
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env từ thư mục gốc
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();

// =============== Config ===============
const ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000"; // Sửa port mặc định
const PORT = process.env.PORT || 5000;

// =============== Middlewares ==========
app.use(
  cors({
    origin: ORIGIN, // Chỉ cho phép origin từ .env
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

// =============== Database Schema Probes ==========
let dbConfig = {
  HAS_GROUP_ID: false,
  GROUP_ID_REQUIRED: false,
  OPT_SCORE_COL: "score",
  OPT_ORDER_COL: "display_order",
  GROUP_TBL: "drl.criteria_group"
};

(async () => {
  try {
    // Probe group_id column
    const qGroup = await pool.query(`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_schema='drl' AND table_name='criterion' AND column_name='group_id' LIMIT 1
    `);
    if (qGroup.rowCount) {
      dbConfig.HAS_GROUP_ID = true;
      dbConfig.GROUP_ID_REQUIRED = qGroup.rows[0].is_nullable === "NO";
    }

    // Probe criterion_option columns
    const qOpt = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='drl' AND table_name='criterion_option'
    `);
    const cols = qOpt.rows.map((x) => x.column_name);
    if (!cols.includes("score")) {
      if (cols.includes("points")) dbConfig.OPT_SCORE_COL = "points";
      else if (cols.includes("point")) dbConfig.OPT_SCORE_COL = "point";
      else if (cols.includes("value")) dbConfig.OPT_SCORE_COL = "value";
    }
    if (!cols.includes("display_order")) {
      if (cols.includes("order_no")) dbConfig.OPT_ORDER_COL = "order_no";
      else if (cols.includes("sort_order")) dbConfig.OPT_ORDER_COL = "sort_order";
      else if (cols.includes('"order"')) dbConfig.OPT_ORDER_COL = '"order"';
      else dbConfig.OPT_ORDER_COL = null;
    }

    // Probe group table name
    const qCriteriaGroup = await pool.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'drl' AND table_name = 'criteria_group' LIMIT 1
    `);
    if (qCriteriaGroup.rowCount) {
      dbConfig.GROUP_TBL = "drl.criteria_group";
    } else {
      const qCriterionGroup = await pool.query(`
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'drl' AND table_name = 'criterion_group' LIMIT 1
      `);
      if (qCriterionGroup.rowCount) {
        dbConfig.GROUP_TBL = "drl.criterion_group";
      } else {
        console.warn("⚠️  No group table found, using default: drl.criteria_group");
      }
    }

    setDbConfig(dbConfig);
    console.log("✅ Database schema probed successfully");
  } catch (e) {
    console.error("❌ Database probe failed:", e.message);
    setDbConfig(dbConfig);
  }
})();

// =============== Routes =======================
import authRoutes from "./routes/auth.js";
import drlRoutes from "./routes/drl.js";
import teacherRoutes from "./routes/teacher.js";
import facultyRoutes from "./routes/faculty.js";
import adminRoutes from "./routes/admin.js";
import hsvRoutes from "./routes/hsv.js";
import termRoutes from "./routes/term.js";
import { protectedRoute, requireRole } from "./middlewares/authMiddleware.js";


app.get("/", (_req, res) => res.send("DRL API is running.")); // Health check cơ bản
app.use("/api/auth", authRoutes);
app.use("/api/terms", termRoutes);
app.use("/api/drl", protectedRoute, requireRole('student', 'teacher', 'admin', 'faculty', 'hsv') , drlRoutes);
app.use("/api/teacher",protectedRoute, requireRole('teacher'),teacherRoutes);
app.use("/api/faculty",protectedRoute, requireRole('faculty') ,facultyRoutes);
app.use("/api/admin", protectedRoute, requireRole('admin'),adminRoutes);
app.use("/api/hsv", protectedRoute, requireRole('hsv') ,hsvRoutes);


// Thêm route lấy health chi tiết hơn (bao gồm trạng thái DB)
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

// =============== Error Handling ===============
// 404 Handler
app.use((_req, res) => res.status(404).json({ error: "not_found" }));

// Global Error Handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("❌ UNCAUGHT ERROR:", err.stack || err);
  res.status(err.status || 500).json({
    error: err.message || "internal_server_error",
    // Thêm stack trace nếu ở môi trường dev (tùy chọn)
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// =============== Start Server ===============
const server = app.listen(PORT, () => {
  console.log(`🚀 DRL API running at http://localhost:${PORT}`);
  console.log(`🔑 Allowing requests from: ${ORIGIN}`);
});

// =============== Graceful Shutdown ===============
process.on("SIGINT", async () => {
  console.log("\n🔌 Shutting down server...");
  server.close(async () => {
    console.log("🚪 Server closed.");
    await pool.end();
    console.log("💧 Database pool closed.");
    process.exit(0);
  });
});

process.on("SIGTERM", async () => {
  console.log("\n🔌 SIGTERM received, shutting down gracefully...");
  server.close(async () => {
    console.log("🚪 Server closed.");
    await pool.end();
    console.log("💧 Database pool closed.");
    process.exit(0);
  });
});
