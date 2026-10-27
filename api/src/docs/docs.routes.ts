import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiSpec } from "./openapi.js";

// Trang tài liệu API (Swagger UI) tại /api/docs và đặc tả thô tại /api/docs/openapi.json.
export const docsRouter = Router();

docsRouter.get("/api/docs/openapi.json", (_req, res) => {
  res.json(openApiSpec);
});

docsRouter.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customSiteTitle: "API – Thuyết minh đa ngôn ngữ",
    swaggerOptions: {
      persistAuthorization: true, // giữ token đã Authorize khi tải lại trang
      displayRequestDuration: true,
      docExpansion: "list",
      tryItOutEnabled: true,
    },
  }),
);
