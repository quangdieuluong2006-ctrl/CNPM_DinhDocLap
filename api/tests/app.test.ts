import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { splitBatches } from "../src/db/migrate.js";

const app = createApp();

describe("GET /health", () => {
  it("trả 200 và kèm X-Request-Id", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.headers["x-request-id"]).toBeTruthy();
  });
});

describe("định dạng lỗi chuẩn", () => {
  it("route không tồn tại trả 404 NOT_FOUND kèm requestId", async () => {
    const res = await request(app).get("/khong-ton-tai").set("X-Request-Id", "test-request-0001");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: "NOT_FOUND", requestId: "test-request-0001" });
  });

  it("JSON sai cú pháp trả 400 VALIDATION_ERROR", async () => {
    const res = await request(app).post("/health").set("Content-Type", "application/json").send("{sai");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("splitBatches", () => {
  it("tách theo dòng GO, bỏ khối rỗng, không tách chữ GO trong câu lệnh", () => {
    const sql = "CREATE TABLE a (id INT);\nGO\n\nSELECT 'GOOD' AS go_col;\ngo\nGO\n";
    expect(splitBatches(sql)).toEqual(["CREATE TABLE a (id INT);", "SELECT 'GOOD' AS go_col;"]);
  });
});

describe("kiểm tra đầu vào API xác thực (không cần CSDL)", () => {
  it("đăng nhập thiếu email → 400 VALIDATION_ERROR", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ password: "x" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("clientType không hợp lệ → 400", async () => {
    const res = await request(app).post("/api/v1/auth/refresh").send({ clientType: "tv" });
    expect(res.status).toBe(400);
  });

  it("GET /api/v1/me không có token → 401 AUTH_REQUIRED", async () => {
    const res = await request(app).get("/api/v1/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_REQUIRED");
  });
});

describe("mất kết nối CSDL", () => {
  it("lỗi kết nối SQL Server → 503 DB_UNAVAILABLE", async () => {
    const { default: express } = await import("express");
    const { default: sql } = await import("mssql");
    const { errorHandler } = await import("../src/middlewares/errorHandler.js");
    const mini = express();
    mini.get("/x", () => {
      throw new sql.ConnectionError("Failed to connect to localhost:1433", "ESOCKET");
    });
    mini.use(errorHandler);
    const res = await request(mini).get("/x");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("DB_UNAVAILABLE");
  });
});

describe("chọn card mạng cho mã QR", () => {
  it("Wi-Fi thật đứng trên card ảo (Radmin VPN, WSL, Docker)", async () => {
    const { __test } = await import("../src/modules/admin/joinLink.js");
    const cards = [
      ["Radmin VPN", "26.10.20.30"],
      ["vEthernet (WSL (Hyper-V firewall))", "172.25.144.1"],
      ["br-c3931e6eb5f5", "172.18.0.1"],
      ["Ethernet", "192.168.0.20"],
      ["Wi-Fi", "192.168.1.15"],
    ] as const;
    const ranked = [...cards].sort((a, b) => __test.score(b[0], b[1]) - __test.score(a[0], a[1]));
    expect(ranked[0]![0]).toBe("Wi-Fi");
    expect(ranked[1]![0]).toBe("Ethernet");
    expect(ranked.slice(-3).map((c) => c[0])).not.toContain("Wi-Fi");
  });
});
