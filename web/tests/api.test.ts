import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authRequest, clearSession, getAccessToken, sendVisit, startGuest, uuidV4 } from "../src/lib/api";

const session = (token: string) => ({
  accessToken: token,
  expiresIn: 900,
  csrfToken: "csrf-1",
  user: { id: 2, email: "guest-1@guest.local", fullName: "Khách #A1B2", role: "user", status: "active", uiLocale: "vi", narrationLang: "vi", isGuest: true, createdAt: "2026-10-22T00:00:00Z" },
});
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const expired = () => json(401, { error: { code: "AUTH_TOKEN_EXPIRED", message: "Phiên đăng nhập đã hết hạn" } });

describe("lớp gọi API của Web User", () => {
  beforeEach(() => clearSession());
  afterEach(() => vi.unstubAllGlobals());

  it("khách ẩn danh: gọi /auth/guest với clientType=web, kèm cookie; giữ access token trong bộ nhớ", async () => {
    const fetchMock = vi.fn(async () => json(201, session("tok-1")));
    vi.stubGlobal("fetch", fetchMock);
    await startGuest("ja", "en");
    expect(getAccessToken()).toBe("tok-1");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/auth\/guest$/);
    expect(JSON.parse(init.body as string)).toEqual({ clientType: "web", narrationLang: "ja", locale: "en" });
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

  it("ghi lượt nghe: có clientId UUID, keepalive; có phiên khách thì gắn Authorization", async () => {
    const fetchMock = vi.fn(async (url: string) => (url.endsWith("/auth/guest") ? json(201, session("tok-2")) : json(201, { result: "accepted" })));
    vi.stubGlobal("fetch", fetchMock);
    const visit = { placeId: 7, lang: "vi", trigger: "qr" as const, listenedSec: 30, completed: false, startedAt: "2026-10-23T03:00:00Z" };
    sendVisit(visit);
    let [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.keepalive).toBe(true);
    expect(new Headers(init.headers).get("Authorization")).toBeNull();
    expect(JSON.parse(init.body as string).clientId).toMatch(/^[0-9a-f-]{36}$/);

    await startGuest("vi", "vi");
    sendVisit(visit);
    [, init] = fetchMock.mock.calls[2] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok-2");
  });

  it("mở bằng http://<IP> (không có crypto.randomUUID): vẫn tạo clientId UUID v4 và gửi được lượt nghe", () => {
    const fetchMock = vi.fn(async () => json(201, {}));
    vi.stubGlobal("fetch", fetchMock);
    const real = globalThis.crypto;
    vi.stubGlobal("crypto", { getRandomValues: (a: Uint8Array<ArrayBuffer>) => real.getRandomValues(a) });
    expect(uuidV4()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(() => sendVisit({ placeId: 7, lang: "vi", trigger: "qr", listenedSec: 5, completed: false, startedAt: "2026-10-27T03:00:00Z" })).not.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
