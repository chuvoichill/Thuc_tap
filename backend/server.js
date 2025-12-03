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

// =============== Database Schema Probes (Chạy khi khởi động) ==========
let dbConfig = {
  // Tạo object tạm thời
  HAS_GROUP_ID: false,
  GROUP_ID_REQUIRED: false,
  OPT_SCORE_COL: "score",
  OPT_ORDER_COL: "display_order",
  GROUP_TBL: "drl.criterion_group",
};

(async () => {
  try {
    // Probe group_id
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
      else if (cols.includes("sort_order"))
        dbConfig.OPT_ORDER_COL = "sort_order";
      else if (cols.includes('"order"')) dbConfig.OPT_ORDER_COL = '"order"';
      else dbConfig.OPT_ORDER_COL = null; // Quan trọng: set là null nếu không có
    }
    // Probe group table name (kiểm tra xem bảng criterion_group có tồn tại không)
    const qGroupTable = await pool.query(`
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'drl' AND table_name = 'criterion_group'
     `);
    if (!qGroupTable.rowCount) {
      // Nếu không có bảng criterion_group, thử tìm criteria_group
      const qAltGroupTable = await pool.query(`
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'drl' AND table_name = 'criteria_group'
        `);
      if (qAltGroupTable.rowCount) {
        dbConfig.GROUP_TBL = "drl.criteria_group"; // Đổi tên bảng nếu cần
      } else {
        console.warn("❌ Cannot find criterion_group or criteria_group table!");
        // Có thể quyết định dừng server ở đây nếu bảng nhóm là bắt buộc
      }
    }

    // --- KIỂM TRA LẠI LOGIC PROBE TÊN BẢNG GROUP ---
    let foundGroupTable = false;
    const primaryGroupName = 'drl.criteria_group'; // Ưu tiên tên này dựa trên lỗi FK
    const alternativeGroupName = 'drl.criterion_group';

    // 1. Thử tìm tên bảng chính (từ lỗi FK) trước
    try {
        console.log(`[INIT] Checking for primary group table: ${primaryGroupName}`);
        const qPrimaryTable = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = 'drl' AND table_name = 'criteria_group' LIMIT 1`);
        if (qPrimaryTable.rowCount > 0) {
            dbConfig.GROUP_TBL = primaryGroupName;
            foundGroupTable = true;
            console.log(`[INIT] Found primary group table: ${dbConfig.GROUP_TBL}`);
        }
    } catch (e) { console.warn(`[INIT] Error checking for ${primaryGroupName}:`, e.message); }

    // 2. Nếu không thấy bảng chính, thử tìm tên thay thế
    if (!foundGroupTable) {
        try {
            console.log(`[INIT] Primary group table not found. Checking for alternative: ${alternativeGroupName}`);
            const qAltTable = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = 'drl' AND table_name = 'criterion_group' LIMIT 1`);
            if (qAltTable.rowCount > 0) {
                dbConfig.GROUP_TBL = alternativeGroupName;
                foundGroupTable = true;
                console.log(`[INIT] Found alternative group table: ${dbConfig.GROUP_TBL}`);
            }
        } catch (e) { console.warn(`[INIT] Error checking for ${alternativeGroupName}:`, e.message); }
    }

    // 3. Nếu không tìm thấy bảng nào -> Báo lỗi nghiêm trọng và dùng tên mặc định (từ lỗi FK)
    if (!foundGroupTable) {
         console.error(`❌ CRITICAL: Cannot find ${primaryGroupName} or ${alternativeGroupName} table! Defaulting to ${primaryGroupName}, but errors are highly likely.`);
         // Gán tên bảng từ lỗi FK làm mặc định để tránh lỗi undefined query ngay lập tức
         dbConfig.GROUP_TBL = primaryGroupName;
    }

    console.log("[INIT] Database probes completed.");
    console.log('[DEBUG] Final dbConfig before setting:', JSON.stringify(dbConfig)); // Log để kiểm tra
    setDbConfig(dbConfig); // Gọi hàm để cập nhật config trong helpers.js
  } catch (e) {
    console.error("❌ Database probe failed:", e.message);
    // Quyết định có nên dừng server hay không nếu probe lỗi
    // process.exit(1);
    console.log(
      "[DEBUG] Setting potentially incomplete dbConfig due to probe failure:",
      JSON.stringify(dbConfig)
    );

    setDbConfig(dbConfig); // Vẫn set config mặc định/đã dò được phần nào
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
