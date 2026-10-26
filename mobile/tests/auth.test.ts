import { afterEach, describe, expect, it, vi } from "vitest";
import { singleFlight } from "../src/core/singleFlight";
import { ApiError, createApi } from "../src/services/api";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("phiên khách ẩn danh trên Mobile", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("singleFlight: 3 lần gọi đồng thời chỉ chạy hàm một lần; xong rồi gọi lại thì chạy lần mới", async () => {
    let calls = 0;
    const refresh = singleFlight(async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return calls;
    });
    expect(await Promise.all([refresh(), refresh(), refresh()])).toEqual([1, 1, 1]);
    expect(await refresh()).toBe(2);
  });

  it("khách ẩn danh: gọi /auth/guest với clientType=mobile, nhận refreshToken trong body (không email/mật khẩu)", async () => {
    const fetchMock = vi.fn(async () => json(201, { accessToken: "a1", expiresIn: 900, refreshToken: "r1", user: { id: 2, isGuest: true } }));
    vi.stubGlobal("fetch", fetchMock);
    const api = createApi(() => "http://api");
    const s = await api.guest({ locale: "en", narrationLang: "ja" });
    expect(s.refreshToken).toBe("r1");
    expect(s.user.isGuest).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api/api/v1/auth/guest");
    expect(JSON.parse(init.body as string)).toEqual({ locale: "en", narrationLang: "ja", clientType: "mobile" });
  });

  it("access token hết hạn → làm mới một lần rồi gửi lại request với token mới", async () => {
    let token = "old";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) =>
        new Headers(init?.headers).get("Authorization") === "Bearer new"
          ? json(200, { id: 2, fullName: "An" })
          : json(401, { error: { code: "AUTH_TOKEN_EXPIRED", message: "x" } }),
      ),
    );
    const onExpired = vi.fn(async () => {
      token = "new";
      return true;
    });
    const api = createApi(() => "http://api", () => token, onExpired);
    expect(await api.me()).toMatchObject({ fullName: "An" });
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("làm mới thất bại → báo lỗi 401, không lặp vô hạn; lỗi khác 401 không làm mới", async () => {
    const fetchMock = vi.fn(async () => json(401, { error: { code: "AUTH_TOKEN_EXPIRED", message: "x" } }));
    vi.stubGlobal("fetch", fetchMock);
    const onExpired = vi.fn(async () => false);
    const api = createApi(() => "http://api", () => "old", onExpired);
    await expect(api.me()).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.stubGlobal("fetch", vi.fn(async () => json(403, { error: { code: "ACCOUNT_LOCKED", message: "x" } })));
    await expect(api.me()).rejects.toMatchObject({ code: "ACCOUNT_LOCKED" });
    expect(onExpired).toHaveBeenCalledTimes(1);
  });
});
