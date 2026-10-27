import { Router } from "express";
import { getPool } from "../../db/pool.js";
import { ApiError } from "../../lib/apiError.js";

export const healthRouter = Router();

// Sống: tiến trình Node đang chạy.
healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", uptimeSec: Math.round(process.uptime()) });
});

// Sẵn sàng: đã kết nối được SQL Server và đã chạy migration.
healthRouter.get("/health/ready", async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .query<{ migrations: number }>("SELECT COUNT(*) AS migrations FROM dbo.schema_migrations");
    res.json({ status: "ready", database: "ok", migrations: result.recordset[0]?.migrations ?? 0 });
  } catch {
    throw new ApiError(503, "SERVICE_UNAVAILABLE", "Chưa kết nối được cơ sở dữ liệu");
  }
});
