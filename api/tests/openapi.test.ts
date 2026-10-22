import type { Router } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { openApiSpec } from "../src/docs/openapi.js";
import { adminRouter } from "../src/modules/admin/admin.routes.js";
import { authRouter } from "../src/modules/auth/auth.routes.js";
import { healthRouter } from "../src/modules/health/health.routes.js";
import { presenceRouter } from "../src/modules/presence/presence.routes.js";
import { meRouter } from "../src/modules/users/me.routes.js";

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean> };
}

// Liệt kê "METHOD /đường-dẫn" của các router nghiệp vụ, đúng tiền tố như trong app.ts.
function routesOf(router: Router, prefix: string): string[] {
  return (router.stack as RouteLayer[]).flatMap((layer) =>
    layer.route ? Object.keys(layer.route.methods).map((m) => `${m.toUpperCase()} ${prefix}${layer.route!.path}`) : [],
  );
}

const actual = [
  ...routesOf(healthRouter, ""),
  ...[authRouter(), meRouter, presenceRouter, adminRouter].flatMap((r) => routesOf(r, "/api/v1")),
].sort();

const documented = Object.entries(openApiSpec.paths)
  .flatMap(([path, ops]) => Object.keys(ops).map((m) => `${m.toUpperCase()} ${path}`))
  .sort();

describe("tài liệu OpenAPI (Swagger)", () => {
  it("mọi route thật đều có trong tài liệu và ngược lại", () => {
    expect(documented).toEqual(actual);
  });

  it("mọi $ref đều trỏ tới schema có thật", () => {
    const refs = [...JSON.stringify(openApiSpec).matchAll(/"#\/components\/schemas\/([A-Za-z]+)"/g)].map((m) => m[1]!);
    const schemas = Object.keys(openApiSpec.components.schemas);
    for (const r of new Set(refs)) expect(schemas).toContain(r);
  });

  it("GET /api/docs/openapi.json trả đặc tả; /api/docs/ trả trang Swagger UI", async () => {
    const app = createApp();
    const spec = await request(app).get("/api/docs/openapi.json");
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe("3.1.0");
    const ui = await request(app).get("/api/docs/");
    expect(ui.status).toBe(200);
    expect(ui.text).toContain("swagger-ui");
  });
});
