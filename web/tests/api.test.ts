import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authRequest, clearSession, getAccessToken, login, sendVisit } from "../src/lib/api";

const session = (token: string) => ({
  accessToken: token,
  expiresIn: 900,
  csrfToken: "csrf-1",
  user: { id: 2, email: "user1@demo.vn", fullName: "Nguyễn Văn An", role: "user", status: "active", uiLocale: "vi", narrationLang: "vi", createdAt: "2026-10-22T00:00:00Z" },
});
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const expired = () => json(401, { error: { code: "AUTH_TOKEN_EXPIRED", message: "Phiên đăng nhập đã hết hạn" } });

describe("lớp gọi API của Web User", () => {
  beforeEach(() => clearSession());
  afterEach(() => vi.unstubAllGlobals());

  it("đăng nhập gửi clientType=web, kèm cookie; giữ access token trong bộ nhớ", async () => {
    const fetchMock = vi.fn(async () => json(200, session("tok-1")));
    vi.stubGlobal("fetch", fetchMock);
    await login("user1@demo.vn", "Demo@12345");
    expect(getAccessToken()).toBe("tok-1");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ clientType: "web" });
    expect(init.credentials).toBe("include");
  });

  it("3 request cùng hết hạn token → chỉ gọi /auth/refresh MỘT lần (single-flight) rồi gửi lại", async () => {
    let refreshCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/auth/refresh")) {
          refreshCalls++;
          await new Promise((r) => setTimeout(r, 20));
          return json(200, session("tok-new"));
        }
        return new Headers(init?.headers).get("Authorization") === "Bearer tok-new" ? json(200, { ok: true }) : expired();
      }),
    );
    const results = await Promise.all([1, 2, 3].map(() => authRequest<{ ok: boolean }>("/me/visits")));
    expect(results).toEqual(Array(3).fill({ ok: true }));
    expect(refreshCalls).toBe(1);
  });

  it("ghi lượt nghe: có clientId UUID, keepalive; đã đăng nhập thì gắn Authorization", async () => {
    const fetchMock = vi.fn(async (url: string) => (url.endsWith("/auth/login") ? json(200, session("tok-2")) : json(201, { result: "accepted" })));
    vi.stubGlobal("fetch", fetchMock);
    const visit = { placeId: 7, lang: "vi", trigger: "qr" as const, listenedSec: 30, completed: false, startedAt: "2026-10-23T03:00:00Z" };
    sendVisit(visit);
    let [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.keepalive).toBe(true);
    expect(new Headers(init.headers).get("Authorization")).toBeNull();
    expect(JSON.parse(init.body as string).clientId).toMatch(/^[0-9a-f-]{36}$/);

    await login("user1@demo.vn", "Demo@12345");
    sendVisit(visit);
    [, init] = fetchMock.mock.calls[2] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok-2");
  });
});
