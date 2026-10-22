import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler, notFound } from "./middlewares/errorHandler.js";
import { requestId } from "./middlewares/requestId.js";
import { docsRouter } from "./docs/docs.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { presenceRouter } from "./modules/presence/presence.routes.js";
import { meRouter } from "./modules/users/me.routes.js";
import { contentRouter } from "./modules/content/content.routes.js";
import { toursRouter } from "./modules/tours/tours.routes.js";
import { visitsRouter } from "./modules/visits/visits.routes.js";
import { mediaRoot } from "./lib/media.js";

export interface AppOptions {
  loginRateLimitMax?: number; // test dùng giá trị nhỏ để kiểm tra 429
}

// Tạo Express app tách khỏi server.ts để test bằng supertest không cần mở cổng.
export function createApp(opts: AppOptions = {}) {
  const app = express();
  app.disable("x-powered-by");
  // Chỉ tin X-Forwarded-For khi request đi qua proxy trên chính máy này (Vite dev server),
  // để req.ip là IP thật của từng điện thoại – dùng cho giới hạn đăng nhập và nhật ký.
  app.set("trust proxy", "loopback");
  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: (_req, res) => res.locals.requestId as string }));
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use(healthRouter);
  app.use(docsRouter);
  // Tệp âm thanh/ảnh: hỗ trợ HTTP Range (tua), cho phép Web/Mobile ở origin khác phát trực tiếp.
  app.use(
    "/media",
    express.static(mediaRoot, {
      maxAge: "1d",
      fallthrough: true,
      setHeaders: (res) => res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"),
    }),
  );
  app.use(
    "/api/v1",
    authRouter({ loginRateLimitMax: opts.loginRateLimitMax }),
    meRouter,
    presenceRouter,
    contentRouter,
    visitsRouter,
    toursRouter,
    adminRouter,
  );

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
