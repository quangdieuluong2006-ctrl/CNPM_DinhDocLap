import pino from "pino";
import { env } from "../config/env.js";

// Không bao giờ ghi mật khẩu, token hay cookie vào log.
export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
  redact: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.token", "*.refreshToken"],
});
