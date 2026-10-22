import type { ErrorRequestHandler, RequestHandler } from "express";
import sql from "mssql";
import { ZodError } from "zod";
import { ApiError } from "../lib/apiError.js";
import { logger } from "../lib/logger.js";

export const notFound: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, "NOT_FOUND", `Không tìm thấy ${req.method} ${req.path}`));
};

// Mọi lỗi trả về dạng { error: { code, message, details?, requestId } } (PRD v1.0, mục 11.1).
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const requestId = res.locals.requestId as string | undefined;

  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details, requestId } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Dữ liệu không hợp lệ", details: { fields: err.issues }, requestId },
    });
    return;
  }
  // Body JSON sai cú pháp do express.json() ném ra.
  if (typeof err === "object" && err !== null && "type" in err && err.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "JSON không hợp lệ", requestId } });
    return;
  }

  // Mất kết nối SQL Server (chưa bật dịch vụ, sai cổng…): báo 503 rõ ràng thay vì 500 chung chung.
  if (err instanceof sql.ConnectionError) {
    logger.error({ err, requestId }, "Không kết nối được SQL Server");
    res.status(503).json({
      error: { code: "DB_UNAVAILABLE", message: "Chưa kết nối được cơ sở dữ liệu, vui lòng thử lại sau", requestId },
    });
    return;
  }

  logger.error({ err, requestId }, "Lỗi chưa xử lý");
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Hệ thống đang gặp sự cố", requestId } });
};
