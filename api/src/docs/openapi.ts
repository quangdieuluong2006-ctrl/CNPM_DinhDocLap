// Đặc tả OpenAPI 3.1 của API – nguồn cho trang Swagger UI tại /api/docs.
// Khi thêm/sửa route, cập nhật file này; test tests/openapi.test.ts báo lỗi nếu tài liệu lệch với route thật.

const errorResponse = (description: string, code: string, message: string) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
      example: { error: { code, message, requestId: "8f1c2b7e-0d1a-4c55-9a51-3b0f5e2f6a10" } },
    },
  },
});

const E = {
  validation: errorResponse("Dữ liệu không hợp lệ (`details.fields` chỉ ra trường sai)", "VALIDATION_ERROR", "Dữ liệu không hợp lệ"),
  authRequired: errorResponse("Chưa đăng nhập, token sai hoặc hết hạn (`AUTH_REQUIRED`, `AUTH_TOKEN_INVALID`, `AUTH_TOKEN_EXPIRED`)", "AUTH_TOKEN_EXPIRED", "Phiên đăng nhập đã hết hạn"),
  forbidden: errorResponse("Không đủ quyền – cần vai trò admin", "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này"),
  locked: errorResponse("Tài khoản đã bị khóa", "ACCOUNT_LOCKED", "Tài khoản đã bị khóa, vui lòng liên hệ hỗ trợ"),
  dbDown: errorResponse("Không kết nối được SQL Server", "DB_UNAVAILABLE", "Chưa kết nối được cơ sở dữ liệu, vui lòng thử lại sau"),
};

const json = (schemaRef: string, example?: unknown) => ({
  "application/json": { schema: { $ref: `#/components/schemas/${schemaRef}` }, ...(example ? { example } : {}) },
});

const demoUser = {
  id: 2,
  email: "user1@demo.vn",
  fullName: "Nguyễn Văn An",
  role: "user",
  status: "active",
  uiLocale: "vi",
  narrationLang: "vi",
  createdAt: "2026-10-23T05:32:51.000Z",
};

const SOCKET_DOC = `
### Realtime – Socket.IO (cùng cổng với API, đường dẫn \`/socket.io\`)

Kết nối: \`io(API_URL, { auth: { token: accessToken }, query: { clientType: "web" | "admin" | "mobile" } })\`

| Hướng | Sự kiện | Dữ liệu |
|---|---|---|
| Server → Client | \`presence.session\` | \`{ sessionId }\` – đã ghi phiên vào \`user_sessions\` |
| Client → Server | \`presence.ping\` | \`{}\` mỗi 30 giây; ack \`{ ok, sessionId }\` |
| Server → phòng \`admins\` | \`presence.update\` | \`{ activeUsers, activeUsersAll, changed: { userId, type }, ts }\` – \`type\` là \`online\` hoặc \`offline\` |
| Lỗi bắt tay | \`connect_error\` | \`err.data.code\`: \`AUTH_REQUIRED\`, \`AUTH_TOKEN_EXPIRED\`, \`ACCOUNT_LOCKED\`, \`FORBIDDEN\` |

**"Người dùng đang hoạt động"** = có phiên \`user_sessions\` chưa đóng và nhịp tim trong 60 giây gần nhất; đếm \`DISTINCT user_id\` (view \`dbo.v_active_users\`).
`;

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "API Thuyết minh đa ngôn ngữ theo vị trí – Dinh Độc Lập",
    version: "1.0.0",
    description: `Backend Node.js + Express + **SQL Server** của ứng dụng thuyết minh đa ngôn ngữ theo vị trí (PRD v1.0, mục 11–12).

**Thử nhanh:** mở \`POST /api/v1/auth/login\` → *Try it out* → gửi tài khoản mẫu (\`admin@demo.vn\` / \`Demo@12345\`, \`clientType: "mobile"\`)
→ sao chép \`accessToken\` → bấm **Authorize** (góc phải) và dán vào → gọi các API cần đăng nhập như \`GET /api/v1/admin/presence\`.

Mọi lỗi có dạng \`{ "error": { "code", "message", "details?", "requestId" } }\`. Thời gian trả về theo UTC (ISO 8601).
${SOCKET_DOC}`,
  },
  servers: [{ url: "/", description: "Máy chủ hiện tại" }],
  tags: [
    { name: "Hệ thống", description: "Kiểm tra tình trạng API và CSDL" },
    { name: "Xác thực", description: "FE-01: đăng ký, đăng nhập, làm mới phiên, đăng xuất" },
    { name: "Người dùng", description: "Thông tin tài khoản đang đăng nhập" },
    { name: "Presence", description: "Theo dõi người dùng đang hoạt động (PRD mục 4.7)" },
    { name: "Quản trị", description: "FE-17, FE-19 – chỉ vai trò admin" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Access token (15 phút) lấy từ `accessToken` của /auth/login hoặc /auth/register.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string", example: "VALIDATION_ERROR" },
              message: { type: "string" },
              details: {},
              requestId: { type: "string" },
            },
          },
        },
      },
      ClientType: { type: "string", enum: ["web", "admin", "mobile"], description: "Loại ứng dụng gọi API" },
      User: {
        type: "object",
        description: "Không bao giờ chứa password_hash",
        properties: {
          id: { type: "integer" },
          email: { type: "string", format: "email" },
          fullName: { type: "string" },
          role: { type: "string", enum: ["user", "guide", "admin"] },
          status: { type: "string", enum: ["active", "locked"] },
          uiLocale: { type: "string", enum: ["vi", "en"], description: "Ngôn ngữ giao diện" },
          narrationLang: { type: ["string", "null"], description: "Ngôn ngữ thuyết minh mặc định (ISO 639-1)" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Session: {
        type: "object",
        description:
          "Web/Admin: refresh token nằm trong cookie HttpOnly `rt_web`/`rt_admin`, body có `csrfToken`. Mobile: body có `refreshToken`.",
        properties: {
          accessToken: { type: "string" },
          expiresIn: { type: "integer", description: "Số giây access token còn hiệu lực", example: 900 },
          user: { $ref: "#/components/schemas/User" },
          csrfToken: { type: "string", description: "Chỉ có với web/admin – gửi lại qua header X-CSRF-Token" },
          refreshToken: { type: "string", description: "Chỉ có với mobile" },
        },
      },
      RegisterRequest: {
        type: "object",
        required: ["email", "password", "fullName"],
        properties: {
          email: { type: "string", format: "email", example: "sinhvien@lop.edu.vn" },
          password: { type: "string", minLength: 8, maxLength: 72, description: "Ít nhất 8 ký tự, có cả chữ và số", example: "Matkhau123" },
          fullName: { type: "string", maxLength: 100, example: "Nguyễn Minh Anh" },
          locale: { type: "string", enum: ["vi", "en"], default: "vi", description: "Ngôn ngữ giao diện" },
          narrationLang: { type: "string", example: "en", description: "Ngôn ngữ thuyết minh mặc định" },
          clientType: { type: "string", enum: ["web", "mobile"], default: "web" },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "admin@demo.vn" },
          password: { type: "string", example: "Demo@12345" },
          clientType: { $ref: "#/components/schemas/ClientType" },
        },
      },
      RefreshRequest: {
        type: "object",
        properties: {
          clientType: { $ref: "#/components/schemas/ClientType" },
          refreshToken: { type: "string", description: "Chỉ dùng với mobile; web/admin đọc từ cookie" },
        },
      },
      PresenceUser: {
        type: "object",
        properties: {
          userId: { type: "integer" },
          fullName: { type: "string" },
          email: { type: "string" },
          role: { type: "string", enum: ["user", "guide", "admin"] },
          clientTypes: { type: "array", items: { $ref: "#/components/schemas/ClientType" } },
          openSessions: { type: "integer", description: "Số tab/thiết bị đang mở" },
          onlineSince: { type: "string", format: "date-time" },
          lastSeenAt: { type: "string", format: "date-time" },
        },
      },
      PresenceResponse: {
        type: "object",
        properties: {
          count: { type: "integer", description: "Số người theo bộ lọc đang chọn" },
          activeUsers: { type: "integer", description: "Số người đang hoạt động, không tính admin" },
          activeUsersAll: { type: "integer", description: "Tính cả admin" },
          users: { type: "array", items: { $ref: "#/components/schemas/PresenceUser" } },
          ts: { type: "string", format: "date-time" },
        },
      },
      StatsResponse: {
        type: "object",
        properties: {
          totalUsers: { type: "integer", description: "Khách tham quan + hướng dẫn viên" },
          activeUsers: { type: "integer", description: "Đang hoạt động (không tính admin)" },
          visitsToday: { type: "integer", description: "Lượt tham quan hôm nay (giờ Việt Nam, không tính mô phỏng)" },
          activeTours: { type: "integer" },
          publishedPlaces: { type: "integer" },
          pendingContents: { type: "integer", description: "Bài thuyết minh chờ duyệt" },
          visitsByDay: {
            type: "array",
            items: { type: "object", properties: { day: { type: "string", format: "date" }, visits: { type: "integer" } } },
          },
          topPlaces: {
            type: "array",
            items: { type: "object", properties: { code: { type: "string" }, title: { type: "string" }, visits: { type: "integer" } } },
          },
          languages: {
            type: "array",
            items: { type: "object", properties: { code: { type: "string" }, name: { type: "string" }, visits: { type: "integer" } } },
          },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Hệ thống"],
        summary: "API còn sống",
        responses: { 200: { description: "OK", content: { "application/json": { example: { status: "ok", uptimeSec: 125 } } } } },
      },
    },
    "/health/ready": {
      get: {
        tags: ["Hệ thống"],
        summary: "API đã kết nối SQL Server",
        description: "Đếm số migration đã chạy trong bảng `schema_migrations`.",
        responses: {
          200: { description: "Sẵn sàng", content: { "application/json": { example: { status: "ready", database: "ok", migrations: 3 } } } },
          503: errorResponse("Chưa kết nối được CSDL", "SERVICE_UNAVAILABLE", "Chưa kết nối được cơ sở dữ liệu"),
        },
      },
    },
    "/api/v1/auth/register": {
      post: {
        tags: ["Xác thực"],
        summary: "Đăng ký tài khoản",
        description: "Tạo tài khoản và đăng nhập luôn. Ghi `auth.register` vào `activity_logs`.",
        requestBody: { required: true, content: json("RegisterRequest") },
        responses: {
          201: { description: "Đã tạo tài khoản", content: json("Session") },
          400: E.validation,
          409: errorResponse("Email đã được đăng ký", "EMAIL_TAKEN", "Email đã được đăng ký"),
          503: E.dbDown,
        },
      },
    },
    "/api/v1/auth/login": {
      post: {
        tags: ["Xác thực"],
        summary: "Đăng nhập",
        description:
          "`clientType: \"admin\"` chỉ cho tài khoản vai trò admin. Quá 10 lần **sai** trong 15 phút từ một IP → 429. Thành công ghi `auth.login`, thất bại ghi `auth.login_failed`.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
              examples: {
                mobile: { summary: "User trên Mobile (nhận refreshToken trong body)", value: { email: "user1@demo.vn", password: "Demo@12345", clientType: "mobile" } },
                admin: { summary: "Quản trị viên", value: { email: "admin@demo.vn", password: "Demo@12345", clientType: "mobile" } },
              },
            },
          },
        },
        responses: {
          200: { description: "Đăng nhập thành công", content: json("Session", { accessToken: "eyJhbGciOiJIUzI1NiIs…", expiresIn: 900, refreshToken: "kQ3v…", user: demoUser }) },
          400: E.validation,
          401: errorResponse("Sai email hoặc mật khẩu (không tiết lộ trường nào sai)", "AUTH_INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng"),
          403: E.locked,
          429: errorResponse("Thử sai quá nhiều lần – xem header Retry-After", "RATE_LIMITED", "Bạn đã thử quá nhiều lần, vui lòng thử lại sau"),
          503: E.dbDown,
        },
      },
    },
    "/api/v1/auth/refresh": {
      post: {
        tags: ["Xác thực"],
        summary: "Làm mới phiên (xoay vòng refresh token)",
        description:
          "Refresh token cũ bị thu hồi, cấp cặp token mới. Dùng lại token đã thu hồi → coi như bị đánh cắp, thu hồi mọi phiên của user. Web/Admin phải gửi header `X-CSRF-Token`.",
        parameters: [{ name: "X-CSRF-Token", in: "header", required: false, schema: { type: "string" }, description: "Bắt buộc với web/admin" }],
        requestBody: { content: json("RefreshRequest", { clientType: "mobile", refreshToken: "kQ3v…" }) },
        responses: {
          200: { description: "Phiên mới", content: json("Session") },
          401: errorResponse("Refresh token không hợp lệ/hết hạn/đã thu hồi", "AUTH_REFRESH_INVALID", "Phiên đăng nhập không còn hiệu lực, vui lòng đăng nhập lại"),
          403: errorResponse("Thiếu hoặc sai CSRF token (web/admin), hoặc tài khoản bị khóa", "CSRF_INVALID", "Thiếu hoặc sai CSRF token"),
        },
      },
    },
    "/api/v1/auth/logout": {
      post: {
        tags: ["Xác thực"],
        summary: "Đăng xuất (thu hồi refresh token)",
        description: "Luôn trả 204 kể cả khi token đã hết hạn. Web/Admin: xóa cookie.",
        parameters: [{ name: "X-CSRF-Token", in: "header", required: false, schema: { type: "string" }, description: "Bắt buộc với web/admin" }],
        requestBody: { content: json("RefreshRequest") },
        responses: { 204: { description: "Đã đăng xuất" }, 403: errorResponse("Sai CSRF token", "CSRF_INVALID", "Thiếu hoặc sai CSRF token") },
      },
    },
    "/api/v1/me": {
      get: {
        tags: ["Người dùng"],
        summary: "Hồ sơ người đang đăng nhập",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Hồ sơ + gói", content: json("User", demoUser) }, 401: E.authRequired, 403: E.locked },
      },
    },
    "/api/v1/presence/heartbeat": {
      post: {
        tags: ["Presence"],
        summary: "Nhịp tim dự phòng khi không có Socket.IO",
        description: "Gọi mỗi 30 giây. Lần đầu tạo phiên trong `user_sessions`, các lần sau cập nhật `last_seen_at` của cùng phiên.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { sessionId: { type: "integer" }, clientType: { $ref: "#/components/schemas/ClientType" } } },
              example: { clientType: "mobile" },
            },
          },
        },
        responses: {
          200: { description: "Đã ghi nhịp tim", content: { "application/json": { example: { sessionId: 42 } } } },
          401: E.authRequired,
        },
      },
    },
    "/api/v1/admin/stats": {
      get: {
        tags: ["Quản trị"],
        summary: "Số liệu Dashboard (FE-17)",
        description: "Chạy `EXEC dbo.sp_admin_dashboard_stats` + lượt tham quan 7 ngày + 5 điểm nghe nhiều nhất + ngôn ngữ được chọn (30 ngày). \"Hôm nay\" tính theo giờ Việt Nam.",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Thống kê", content: json("StatsResponse") }, 401: E.authRequired, 403: E.forbidden },
      },
    },
    "/api/v1/admin/presence": {
      get: {
        tags: ["Quản trị"],
        summary: "Người dùng đang hoạt động (FE-19)",
        description: "Đọc view `dbo.v_active_users`. Đây là câu trả lời cho \"làm sao biết có 4 user đang hoạt động\".",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "role", in: "query", schema: { type: "string", enum: ["user", "all"], default: "user" }, description: "`user` (mặc định): không tính admin; `all`: tính cả admin" },
          { name: "clientType", in: "query", schema: { $ref: "#/components/schemas/ClientType" }, description: "Lọc theo loại ứng dụng" },
        ],
        responses: {
          200: {
            description: "Danh sách và số lượng",
            content: json("PresenceResponse", {
              count: 4,
              activeUsers: 4,
              activeUsersAll: 5,
              users: [
                { userId: 2, fullName: "Nguyễn Văn An", email: "user1@demo.vn", role: "user", clientTypes: ["web"], openSessions: 2, onlineSince: "2026-10-22T07:53:46.000Z", lastSeenAt: "2026-10-22T07:54:10.000Z" },
              ],
              ts: "2026-10-22T07:54:12.000Z",
            }),
          },
          400: E.validation,
          401: E.authRequired,
          403: E.forbidden,
        },
      },
    },
    "/api/v1/admin/join-link": {
      get: {
        tags: ["Quản trị"],
        summary: "Link mời tham gia (mã QR)",
        description: "Trả link `http://<IP Wi-Fi>:5173/register` của Web User để Web Admin tạo mã QR; card Wi-Fi xếp trước card ảo (VPN, WSL, Docker).",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Các link theo card mạng",
            content: { "application/json": { example: { links: [{ url: "http://192.168.1.22:5173/register", label: "Wi-Fi", recommended: true }] } } },
          },
          401: E.authRequired,
          403: E.forbidden,
        },
      },
    },
  },
} as const;
