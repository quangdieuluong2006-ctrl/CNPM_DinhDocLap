// Phần đặc tả OpenAPI cho nội dung, lượt ghé, nhóm tham quan và quản trị nội dung (PRD v1.0, mục 11.2).
// Gộp vào openApiSpec trong openapi.ts.

const err = (description: string, code: string, message: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { error: { code, message } } } },
});
const json = (ref: string, example?: unknown) => ({
  "application/json": { schema: { $ref: `#/components/schemas/${ref}` }, ...(example ? { example } : {}) },
});
const ok = (description: string, ref: string, example?: unknown) => ({ description, content: json(ref, example) });
const auth = [{ bearerAuth: [] }];
const E = {
  validation: err("Dữ liệu không hợp lệ", "VALIDATION_ERROR", "Dữ liệu không hợp lệ"),
  auth: err("Chưa đăng nhập hoặc token hết hạn", "AUTH_TOKEN_EXPIRED", "Phiên đăng nhập đã hết hạn"),
  forbidden: err("Không đủ quyền", "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này"),
  placeNotFound: err("Không có điểm", "PLACE_NOT_FOUND", "Không tìm thấy điểm thuyết minh"),
  notFound: err("Không tìm thấy", "NOT_FOUND", "Không tìm thấy"),
  tourNotFound: err("Không có nhóm", "TOUR_NOT_FOUND", "Không tìm thấy nhóm"),
};
const q = (name: string, schema: object, description: string, required = false) => ({ name, in: "query", required, schema, description });
const p = (name: string, schema: object, description: string) => ({ name, in: "path", required: true, schema, description });
const lang = q("lang", { type: "string", default: "vi", example: "en" }, "Ngôn ngữ ISO 639-1; thiếu bài thì dự phòng en → vi");
const page = [q("page", { type: "integer", default: 1 }, "Trang"), q("pageSize", { type: "integer", default: 20, maximum: 100 }, "Số dòng mỗi trang")];
const placeId = p("id", { type: "integer" }, "Mã (id) điểm");
const langPath = p("lang", { type: "string", example: "en" }, "Mã ngôn ngữ");
const zones = ["outdoor", "ground", "floor1", "floor2", "rooftop", "basement"];
const paged = (ref: string) => ({
  type: "object",
  properties: {
    items: { type: "array", items: { $ref: `#/components/schemas/${ref}` } },
    page: { type: "integer" },
    pageSize: { type: "integer" },
    total: { type: "integer" },
  },
});
const items = (ref: string) => ({ type: "object", properties: { items: { type: "array", items: { $ref: `#/components/schemas/${ref}` } } } });

export const contentTags = [
  { name: "Nội dung", description: "Công khai, không cần đăng nhập: ngôn ngữ, điểm thuyết minh, gói offline" },
  { name: "Lượt ghé", description: "Ghi lượt nghe (khách chưa đăng nhập vẫn được ghi), lịch sử tham quan" },
  { name: "Nhóm tham quan", description: "FE-10: tạo/tham gia/rời/kết thúc nhóm; chỉ chia sẻ điểm đang nghe, không chia sẻ tọa độ" },
  { name: "Quản trị nội dung", description: "FE-20 → FE-22: điểm, bài theo ngôn ngữ, âm thanh, ảnh, ngôn ngữ. Mọi thay đổi tăng phiên bản nội dung" },
  { name: "Quản trị người dùng", description: "FE-18, FE-23, FE-24: người dùng, nhóm, nhật ký" },
];

export const contentSchemas = {
  Language: {
    type: "object",
    properties: {
      code: { type: "string", example: "ja" },
      nameVi: { type: "string", example: "Tiếng Nhật" },
      nameEn: { type: "string", example: "Japanese" },
      nameNative: { type: "string", example: "日本語" },
      ttsLocale: { type: "string", example: "ja-JP", description: "Mã BCP 47 cho giọng đọc tổng hợp (TTS)" },
      completeness: { type: "integer", description: "% bài đã duyệt trên số điểm đang xuất bản" },
      approved: { type: "integer" },
      pending: { type: "integer" },
    },
  },
  PlaceContent: {
    type: ["object", "null"],
    description: "null nếu điểm chưa có bài hiển thị được (cả ngôn ngữ dự phòng)",
    properties: {
      lang: { type: "string" },
      isFallback: { type: "boolean", description: "true nếu đây là bài ngôn ngữ dự phòng (en/vi)" },
      title: { type: "string" },
      summary: { type: "string" },
      body: { type: "string", description: "Chỉ có ở chi tiết điểm và gói offline" },
      status: { type: "string", enum: ["approved", "pending"], description: "pending: bản dịch chờ duyệt, hiển thị kèm nhãn" },
      audioUrl: { type: ["string", "null"], example: "/media/audio/en/002-1761100000000-a1b2c3.mp3" },
      audioDurationSec: { type: ["integer", "null"] },
      audioBytes: { type: ["integer", "null"] },
    },
  },
  Place: {
    type: "object",
    properties: {
      id: { type: "integer" },
      code: { type: "string", example: "002", description: "Số điểm 3 chữ số (in trên QR/bảng)" },
      slug: { type: "string" },
      trigger: { type: "string", enum: ["gps", "indoor"], description: "gps: tự phát khi vào vùng; indoor: quét QR/nhập số" },
      zone: { type: "string", enum: zones },
      lat: { type: "number" },
      lng: { type: "number" },
      radiusM: { type: "integer", minimum: 15, maximum: 80 },
      priority: { type: "integer" },
      sortOrder: { type: "integer" },
      imageUrl: { type: ["string", "null"] },
      content: { $ref: "#/components/schemas/PlaceContent" },
    },
  },
  PlaceDetail: {
    allOf: [
      { $ref: "#/components/schemas/Place" },
      { type: "object", properties: { languages: { type: "array", items: { type: "string" }, description: "Ngôn ngữ có bài cho điểm này" } } },
    ],
  },
  ContentBundle: {
    type: "object",
    properties: {
      version: { type: "integer" },
      publishedAt: { type: ["string", "null"], format: "date-time" },
      lang: { type: "string" },
      ttsLocale: { type: ["string", "null"] },
      places: { type: "array", items: { $ref: "#/components/schemas/Place" } },
      totalAudioBytes: { type: "integer", description: "Tổng dung lượng âm thanh cần tải để dùng offline" },
    },
  },
  VisitInput: {
    type: "object",
    required: ["clientId", "placeId", "lang", "trigger", "startedAt"],
    properties: {
      clientId: { type: "string", format: "uuid", description: "Do thiết bị sinh; gửi lại cùng giá trị không bị trùng" },
      placeId: { type: "integer" },
      lang: { type: "string" },
      trigger: { type: "string", enum: ["gps", "qr", "code", "manual", "simulated"], description: "simulated không tính vào thống kê" },
      listenedSec: { type: "integer", minimum: 0, default: 0 },
      completed: { type: "boolean", default: false },
      startedAt: { type: "string", format: "date-time", description: "Không ở tương lai, không quá 30 ngày" },
    },
  },
  MyVisit: {
    type: "object",
    properties: {
      id: { type: "integer" },
      placeId: { type: "integer" },
      placeCode: { type: "string" },
      title: { type: "string" },
      lang: { type: "string" },
      trigger: { type: "string" },
      listenedSec: { type: "integer" },
      completed: { type: "boolean" },
      startedAt: { type: "string", format: "date-time" },
    },
  },
  Tour: {
    type: "object",
    properties: {
      id: { type: "integer" },
      code: { type: "string", example: "K7QX2M", description: "Mã 6 ký tự để tham gia (không phân biệt hoa thường)" },
      name: { type: "string" },
      guide: { type: "object", properties: { id: { type: "integer" }, fullName: { type: "string" } } },
      status: { type: "string", enum: ["active", "ended"] },
      maxMembers: { type: "integer" },
      memberCount: { type: "integer" },
      createdAt: { type: "string", format: "date-time" },
      endedAt: { type: ["string", "null"], format: "date-time" },
    },
  },
  TourMember: {
    type: "object",
    properties: {
      userId: { type: "integer" },
      fullName: { type: "string" },
      isGuide: { type: "boolean" },
      online: { type: "boolean" },
      joinedAt: { type: "string", format: "date-time" },
      currentPlaceId: { type: ["integer", "null"] },
      currentPlaceCode: { type: ["string", "null"] },
      currentPlaceAt: { type: ["string", "null"], format: "date-time" },
    },
  },
  PlaceInput: {
    type: "object",
    required: ["code", "slug", "internalName", "trigger", "zone", "lat", "lng"],
    properties: {
      code: { type: "string", pattern: "^[0-9]{3}$", example: "301" },
      slug: { type: "string", example: "phong-trinh-chieu" },
      internalName: { type: "string", example: "Phòng trình chiếu" },
      trigger: { type: "string", enum: ["gps", "indoor"] },
      zone: { type: "string", enum: zones },
      lat: { type: "number", example: 10.7771 },
      lng: { type: "number", example: 106.6955 },
      radiusM: { type: "integer", minimum: 15, maximum: 80, default: 25 },
      priority: { type: "integer", default: 0 },
      sortOrder: { type: "integer", default: 0 },
      status: { type: "string", enum: ["draft", "published", "hidden"], default: "draft" },
    },
  },
  AdminPlace: {
    type: "object",
    properties: {
      id: { type: "integer" },
      code: { type: "string" },
      slug: { type: "string" },
      internalName: { type: "string" },
      trigger: { type: "string" },
      zone: { type: "string" },
      lat: { type: "number" },
      lng: { type: "number" },
      radiusM: { type: "integer" },
      priority: { type: "integer" },
      sortOrder: { type: "integer" },
      imageUrl: { type: ["string", "null"] },
      status: { type: "string", enum: ["draft", "published", "hidden"] },
      visits: { type: "integer", description: "Lượt ghé (không tính mô phỏng)" },
      contents: {
        type: "object",
        properties: { approved: { type: "integer" }, pending: { type: "integer" }, draft: { type: "integer" }, withAudio: { type: "integer" } },
      },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: ["string", "null"], format: "date-time" },
    },
  },
  PlaceSaved: {
    type: "object",
    properties: {
      place: { $ref: "#/components/schemas/AdminPlace" },
      warnings: {
        type: "array",
        description: "Điểm GPS có vùng giao nhau sâu hơn 50% bán kính (chỉ cảnh báo, vẫn lưu)",
        items: { type: "object", properties: { code: { type: "string" }, distanceM: { type: "integer" }, overlapM: { type: "integer" } } },
      },
      version: { type: "integer", description: "Phiên bản nội dung mới" },
    },
  },
  ContentInput: {
    type: "object",
    required: ["title", "summary", "body"],
    properties: {
      title: { type: "string", maxLength: 120 },
      summary: { type: "string", maxLength: 300 },
      body: { type: "string", maxLength: 5000 },
      status: { type: "string", enum: ["draft", "pending", "approved"], default: "draft", description: "draft không hiển thị cho khách" },
      source: { type: "string", enum: ["human", "machine"], default: "human" },
    },
  },
  AdminContent: {
    type: "object",
    properties: {
      lang: { type: "string" },
      title: { type: "string" },
      summary: { type: "string" },
      body: { type: "string" },
      status: { type: "string", enum: ["draft", "pending", "approved"] },
      source: { type: "string", enum: ["human", "machine"] },
      audioUrl: { type: ["string", "null"] },
      audioDurationSec: { type: ["integer", "null"] },
      audioBytes: { type: ["integer", "null"] },
      updatedBy: { type: ["object", "null"], properties: { id: { type: "integer" }, fullName: { type: "string" } } },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  ContentSaved: {
    type: "object",
    properties: { content: { $ref: "#/components/schemas/AdminContent" }, version: { type: "integer" } },
  },
  AdminLanguage: {
    type: "object",
    properties: {
      code: { type: "string" },
      nameVi: { type: "string" },
      nameEn: { type: "string" },
      nameNative: { type: "string" },
      ttsLocale: { type: "string" },
      isEnabled: { type: "boolean" },
      sortOrder: { type: "integer" },
      publishedPlaces: { type: "integer" },
      approved: { type: "integer" },
      pending: { type: "integer" },
      draft: { type: "integer" },
      completeness: { type: "integer" },
    },
  },
  CatalogLanguage: {
    type: "object",
    properties: {
      code: { type: "string" },
      nameVi: { type: "string" },
      nameEn: { type: "string" },
      nameNative: { type: "string" },
      ttsLocale: { type: "string" },
      added: { type: "boolean", description: "Đã có trong hệ thống" },
    },
  },
  AdminUser: {
    type: "object",
    properties: {
      id: { type: "integer" },
      email: { type: "string" },
      fullName: { type: "string" },
      role: { type: "string", enum: ["user", "guide", "admin"] },
      status: { type: "string", enum: ["active", "locked"] },
      lockedReason: { type: ["string", "null"] },
      uiLocale: { type: "string" },
      narrationLang: { type: ["string", "null"] },
      createdAt: { type: "string", format: "date-time" },
      online: { type: "boolean", description: "Theo view v_active_users" },
      clientTypes: { type: "array", items: { type: "string" } },
      lastSeenAt: { type: ["string", "null"], format: "date-time", description: "Hoạt động gần nhất" },
      tour: { type: ["object", "null"], properties: { id: { type: "integer" }, code: { type: "string" }, name: { type: "string" } } },
      visits: { type: "integer" },
    },
  },
  ActivityLog: {
    type: "object",
    properties: {
      id: { type: "integer" },
      user: { type: ["object", "null"], properties: { id: { type: "integer" }, fullName: { type: "string" }, email: { type: "string" } } },
      action: { type: "string", example: "place.content.update" },
      entityType: { type: ["string", "null"] },
      entityId: { type: ["integer", "null"] },
      ip: { type: ["string", "null"] },
      detail: {},
      createdAt: { type: "string", format: "date-time" },
    },
  },
};

const multipart = (extra: Record<string, object>, desc: string) => ({
  required: true,
  content: {
    "multipart/form-data": {
      schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary", description: desc }, ...extra } },
    },
  },
});

export const contentPaths = {
  "/api/v1/me": {
    patch: {
      tags: ["Người dùng"],
      summary: "Sửa hồ sơ",
      description: "Đổi tên, ngôn ngữ giao diện, ngôn ngữ thuyết minh mặc định (phải là ngôn ngữ đang bật).",
      security: auth,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: { fullName: { type: "string" }, uiLocale: { type: "string", enum: ["vi", "en"] }, narrationLang: { type: "string" } },
            },
            example: { narrationLang: "ko" },
          },
        },
      },
      responses: { 200: ok("Hồ sơ sau khi sửa", "User"), 400: E.validation, 401: E.auth },
    },
  },
  "/api/v1/languages": {
    get: {
      tags: ["Nội dung"],
      summary: "Ngôn ngữ thuyết minh khả dụng",
      description: "Ngôn ngữ đang bật và có ít nhất một bài hiển thị được, kèm mức hoàn thiện. Tìm kiếm/thanh kéo chọn ngôn ngữ làm ở client.",
      responses: { 200: { description: "Danh sách", content: { "application/json": { schema: items("Language") } } } },
    },
  },
  "/api/v1/places": {
    get: {
      tags: ["Nội dung"],
      summary: "Danh sách điểm đã xuất bản",
      description: "Mỗi điểm kèm tiêu đề/tóm tắt theo ngôn ngữ (không có `body`).",
      parameters: [lang, q("zone", { type: "string", enum: zones }, "Lọc khu vực"), q("q", { type: "string" }, "Tìm theo số điểm, tiêu đề, tóm tắt")],
      responses: {
        200: {
          description: "Danh sách",
          content: { "application/json": { schema: { type: "object", properties: { lang: { type: "string" }, items: { type: "array", items: { $ref: "#/components/schemas/Place" } } } } } },
        },
        400: E.validation,
      },
    },
  },
  "/api/v1/places/{code}": {
    get: {
      tags: ["Nội dung"],
      summary: "Chi tiết điểm theo số điểm (QR, bàn phím số)",
      parameters: [p("code", { type: "string", pattern: "^[0-9]{3}$", example: "101" }, "Số điểm 3 chữ số"), lang],
      responses: { 200: ok("Bài đầy đủ", "PlaceDetail"), 400: E.validation, 404: E.placeNotFound },
    },
  },
  "/api/v1/content/version": {
    get: {
      tags: ["Nội dung"],
      summary: "Phiên bản nội dung hiện tại",
      responses: { 200: { description: "Phiên bản", content: { "application/json": { example: { version: 42, publishedAt: "2026-10-24T03:00:00.000Z" } } } } },
    },
  },
  "/api/v1/content/bundle": {
    get: {
      tags: ["Nội dung"],
      summary: "Gói nội dung offline",
      description: "Toàn bộ điểm đã xuất bản + bài đầy đủ của một ngôn ngữ. Header `ETag: \"v{version}-{lang}\"`; gửi `If-None-Match` → 304 nếu không đổi.",
      parameters: [lang, { name: "If-None-Match", in: "header", required: false, schema: { type: "string" }, description: "ETag lần tải trước" }],
      responses: { 200: ok("Gói nội dung", "ContentBundle"), 304: { description: "Không có gì mới" }, 400: E.validation },
    },
  },
  "/api/v1/visits": {
    post: {
      tags: ["Lượt ghé"],
      summary: "Ghi một lượt ghé",
      description: "Không bắt buộc đăng nhập (khách ghi với user_id NULL). Có header Authorization thì phải hợp lệ. Phát `admin.visit.created` tới Web Admin.",
      requestBody: { required: true, content: json("VisitInput", { clientId: "7a1c2e4b-8f0d-4c55-9a51-3b0f5e2f6a10", placeId: 2, lang: "en", trigger: "gps", listenedSec: 96, completed: true, startedAt: "2026-10-28T03:12:05Z" }) },
      responses: {
        201: { description: "Đã ghi", content: { "application/json": { example: { result: "accepted" } } } },
        200: { description: "Đã có lượt cùng clientId", content: { "application/json": { example: { result: "duplicate" } } } },
        400: E.validation,
        401: E.auth,
        404: E.placeNotFound,
      },
    },
  },
  "/api/v1/visits/batch": {
    post: {
      tags: ["Lượt ghé"],
      summary: "Đồng bộ lượt ghé ghi khi offline (tối đa 200)",
      description: "Từng lượt xử lý riêng: lượt sai không làm hỏng cả lô.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object", properties: { visits: { type: "array", items: { $ref: "#/components/schemas/VisitInput" } } } } } },
      },
      responses: {
        200: { description: "Kết quả", content: { "application/json": { example: { accepted: 2, duplicates: 1, rejected: 1, errors: [{ index: 3, code: "VALIDATION_ERROR" }] } } } },
        400: E.validation,
        401: E.auth,
      },
    },
  },
  "/api/v1/me/visits": {
    get: {
      tags: ["Lượt ghé"],
      summary: "Lịch sử tham quan của tôi",
      security: auth,
      parameters: page,
      responses: { 200: { description: "Mới nhất trước", content: { "application/json": { schema: paged("MyVisit") } } }, 401: E.auth },
    },
  },
  "/api/v1/tours": {
    post: {
      tags: ["Nhóm tham quan"],
      summary: "Tạo nhóm (hướng dẫn viên, admin)",
      description: "Người tạo là thành viên đầu tiên. Đang ở nhóm khác → 409 ALREADY_IN_TOUR.",
      security: auth,
      requestBody: { required: true, content: { "application/json": { example: { name: "Đoàn Hàn Quốc 28/10", maxMembers: 30 } } } },
      responses: { 201: ok("Nhóm mới", "Tour"), 400: E.validation, 401: E.auth, 403: E.forbidden, 409: err("Đang ở nhóm khác", "ALREADY_IN_TOUR", "Bạn đang ở một nhóm khác") },
    },
  },
  "/api/v1/me/tour": {
    get: {
      tags: ["Nhóm tham quan"],
      summary: "Nhóm hiện tại của tôi",
      security: auth,
      responses: { 200: { description: "`tour` là null nếu không ở nhóm nào", content: { "application/json": { schema: { type: "object", properties: { tour: { $ref: "#/components/schemas/Tour" } } } } } }, 401: E.auth },
    },
  },
  "/api/v1/tours/{code}": {
    get: {
      tags: ["Nhóm tham quan"],
      summary: "Thông tin nhóm theo mã",
      security: auth,
      parameters: [p("code", { type: "string", example: "K7QX2M" }, "Mã nhóm 6 ký tự")],
      responses: { 200: ok("Nhóm", "Tour"), 401: E.auth, 404: E.tourNotFound },
    },
  },
  "/api/v1/tours/{code}/join": {
    post: {
      tags: ["Nhóm tham quan"],
      summary: "Tham gia nhóm",
      description: "Gọi lại khi đã là thành viên → 200 (không lỗi). Socket của người dùng vào phòng `tour:{id}` ngay.",
      security: auth,
      parameters: [p("code", { type: "string" }, "Mã nhóm")],
      responses: {
        201: { description: "Đã tham gia", content: { "application/json": { example: { result: "joined", tour: { id: 3, code: "K7QX2M" } } } } },
        200: { description: "Đã là thành viên", content: { "application/json": { example: { result: "already_member" } } } },
        401: E.auth,
        404: E.tourNotFound,
        409: err("TOUR_ENDED / TOUR_FULL / ALREADY_IN_TOUR (details: { tourId, code })", "TOUR_FULL", "Nhóm đã đủ thành viên"),
      },
    },
  },
  "/api/v1/tours/{id}/leave": {
    post: {
      tags: ["Nhóm tham quan"],
      summary: "Rời nhóm",
      security: auth,
      parameters: [p("id", { type: "integer" }, "Mã (id) nhóm")],
      responses: { 204: { description: "Đã rời" }, 401: E.auth, 404: E.tourNotFound },
    },
  },
  "/api/v1/tours/{id}/members": {
    get: {
      tags: ["Nhóm tham quan"],
      summary: "Thành viên, trực tuyến, điểm đang nghe",
      description: "Chỉ thành viên, hướng dẫn viên của nhóm hoặc admin. Không trả tọa độ.",
      security: auth,
      parameters: [p("id", { type: "integer" }, "Mã (id) nhóm")],
      responses: {
        200: {
          description: "Danh sách",
          content: {
            "application/json": {
              schema: { type: "object", properties: { tour: { $ref: "#/components/schemas/Tour" }, members: { type: "array", items: { $ref: "#/components/schemas/TourMember" } } } },
            },
          },
        },
        401: E.auth,
        403: E.forbidden,
        404: E.tourNotFound,
      },
    },
  },
  "/api/v1/tours/{id}/end": {
    post: {
      tags: ["Nhóm tham quan"],
      summary: "Kết thúc nhóm (hướng dẫn viên của nhóm, admin)",
      description: "Phát `tour.ended` tới phòng `tour:{id}`.",
      security: auth,
      parameters: [p("id", { type: "integer" }, "Mã (id) nhóm")],
      responses: { 204: { description: "Đã kết thúc" }, 401: E.auth, 403: E.forbidden, 404: E.tourNotFound, 409: err("Nhóm đã kết thúc", "TOUR_ENDED", "Nhóm đã kết thúc") },
    },
  },
  "/api/v1/admin/places": {
    get: {
      tags: ["Quản trị nội dung"],
      summary: "Danh sách điểm (cả nháp, ẩn)",
      security: auth,
      parameters: [
        q("status", { type: "string", enum: ["draft", "published", "hidden"] }, "Lọc trạng thái"),
        q("zone", { type: "string", enum: zones }, "Lọc khu vực"),
        q("q", { type: "string" }, "Tìm theo số điểm, slug, tên nội bộ"),
      ],
      responses: { 200: { description: "Danh sách", content: { "application/json": { schema: items("AdminPlace") } } }, 401: E.auth, 403: E.forbidden },
    },
    post: {
      tags: ["Quản trị nội dung"],
      summary: "Thêm điểm",
      security: auth,
      requestBody: { required: true, content: json("PlaceInput") },
      responses: {
        201: ok("Đã thêm", "PlaceSaved"),
        400: E.validation,
        401: E.auth,
        403: E.forbidden,
        409: err("Trùng số điểm hoặc slug", "PLACE_CODE_TAKEN", "Số điểm đã được dùng cho điểm khác"),
      },
    },
  },
  "/api/v1/admin/places/{id}": {
    get: {
      tags: ["Quản trị nội dung"],
      summary: "Chi tiết điểm + mọi bài (mọi trạng thái)",
      security: auth,
      parameters: [placeId],
      responses: {
        200: {
          description: "Chi tiết",
          content: {
            "application/json": {
              schema: { type: "object", properties: { place: { $ref: "#/components/schemas/AdminPlace" }, contents: { type: "array", items: { $ref: "#/components/schemas/AdminContent" } } } },
            },
          },
        },
        401: E.auth,
        403: E.forbidden,
        404: E.placeNotFound,
      },
    },
    patch: {
      tags: ["Quản trị nội dung"],
      summary: "Sửa điểm (chỉ các trường gửi lên)",
      description: "Đổi `status` sang `published`/`hidden` để xuất bản/ẩn.",
      security: auth,
      parameters: [placeId],
      requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/PlaceInput" }, example: { status: "published", radiusM: 30 } } } },
      responses: { 200: ok("Đã sửa", "PlaceSaved"), 400: E.validation, 401: E.auth, 403: E.forbidden, 404: E.placeNotFound, 409: err("Trùng", "PLACE_CODE_TAKEN", "Số điểm đã được dùng cho điểm khác") },
    },
    delete: {
      tags: ["Quản trị nội dung"],
      summary: "Xóa điểm (chỉ khi chưa có lượt ghé)",
      security: auth,
      parameters: [placeId],
      responses: { 204: { description: "Đã xóa (kèm tệp âm thanh, ảnh)" }, 401: E.auth, 403: E.forbidden, 404: E.placeNotFound, 409: err("Đã có lượt ghé – hãy ẩn", "PLACE_HAS_VISITS", "Điểm đã có lượt ghé nên không xóa được") },
    },
  },
  "/api/v1/admin/places/{id}/contents/{lang}": {
    put: {
      tags: ["Quản trị nội dung"],
      summary: "Tạo/sửa bài một ngôn ngữ",
      description: "Ngôn ngữ phải được thêm trước (Quản lý ngôn ngữ). Quy trình: draft → pending → approved.",
      security: auth,
      parameters: [placeId, langPath],
      requestBody: { required: true, content: json("ContentInput", { title: "Tanks 390 and 843", summary: "…", body: "…", status: "approved", source: "human" }) },
      responses: { 201: ok("Đã tạo", "ContentSaved"), 200: ok("Đã sửa", "ContentSaved"), 400: E.validation, 401: E.auth, 403: E.forbidden, 404: E.placeNotFound },
    },
    delete: {
      tags: ["Quản trị nội dung"],
      summary: "Xóa bài một ngôn ngữ",
      security: auth,
      parameters: [placeId, langPath],
      responses: { 204: { description: "Đã xóa" }, 401: E.auth, 403: E.forbidden, 404: E.notFound },
    },
  },
  "/api/v1/admin/places/{id}/contents/{lang}/audio": {
    post: {
      tags: ["Quản trị nội dung"],
      summary: "Tải tệp âm thanh cho bài",
      description: "multipart/form-data. Định dạng mp3, m4a, aac, ogg, wav, webm; tối đa MAX_AUDIO_MB (mặc định 20 MB). Tệp cũ bị xóa. Phát qua `/media/audio/...` có hỗ trợ HTTP Range.",
      security: auth,
      parameters: [placeId, langPath],
      requestBody: multipart({ durationSec: { type: "integer", description: "Thời lượng (giây), trình duyệt đo từ thẻ <audio>" } }, "Tệp âm thanh"),
      responses: {
        201: ok("Đã tải lên", "ContentSaved"),
        400: E.validation,
        401: E.auth,
        403: E.forbidden,
        404: E.notFound,
        413: err("Tệp quá lớn", "FILE_TOO_LARGE", "Tệp vượt quá dung lượng cho phép"),
        415: err("Sai định dạng", "UNSUPPORTED_MEDIA", "Định dạng không được hỗ trợ"),
      },
    },
    delete: {
      tags: ["Quản trị nội dung"],
      summary: "Xóa tệp âm thanh (ứng dụng sẽ dùng giọng đọc tổng hợp)",
      security: auth,
      parameters: [placeId, langPath],
      responses: { 204: { description: "Đã xóa" }, 401: E.auth, 403: E.forbidden, 404: E.notFound },
    },
  },
  "/api/v1/admin/places/{id}/image": {
    post: {
      tags: ["Quản trị nội dung"],
      summary: "Tải ảnh điểm",
      description: "jpg, png, webp; tối đa MAX_IMAGE_MB (mặc định 5 MB).",
      security: auth,
      parameters: [placeId],
      requestBody: multipart({}, "Ảnh"),
      responses: {
        201: ok("Đã tải lên", "PlaceSaved"),
        400: E.validation,
        401: E.auth,
        403: E.forbidden,
        404: E.placeNotFound,
        413: err("Tệp quá lớn", "FILE_TOO_LARGE", "Tệp vượt quá dung lượng cho phép"),
        415: err("Sai định dạng", "UNSUPPORTED_MEDIA", "Định dạng không được hỗ trợ"),
      },
    },
  },
  "/api/v1/admin/languages": {
    get: {
      tags: ["Quản trị nội dung"],
      summary: "Ngôn ngữ đã thêm + mức hoàn thiện",
      security: auth,
      responses: { 200: { description: "Danh sách", content: { "application/json": { schema: items("AdminLanguage") } } }, 401: E.auth, 403: E.forbidden },
    },
  },
  "/api/v1/admin/languages/catalog": {
    get: {
      tags: ["Quản trị nội dung"],
      summary: "Danh mục 183 ngôn ngữ ISO 639-1 có tìm kiếm",
      description: "Khớp mã, tên tiếng Việt (gõ không dấu được), tên tiếng Anh, tên bản ngữ: \"nhat\", \"japanese\", \"日本\", \"ja\".",
      security: auth,
      parameters: [q("q", { type: "string" }, "Từ khóa")],
      responses: { 200: { description: "Kết quả", content: { "application/json": { schema: items("CatalogLanguage") } } }, 401: E.auth, 403: E.forbidden },
    },
  },
  "/api/v1/admin/languages/{code}": {
    put: {
      tags: ["Quản trị nội dung"],
      summary: "Thêm (từ danh mục) / sửa / bật / tắt ngôn ngữ",
      description: "Body rỗng `{}` thêm ngôn ngữ với tên và ttsLocale từ danh mục. Không tắt được vi, en (ngôn ngữ dự phòng).",
      security: auth,
      parameters: [p("code", { type: "string", example: "it" }, "Mã ISO 639-1")],
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                nameVi: { type: "string" }, nameEn: { type: "string" }, nameNative: { type: "string" },
                ttsLocale: { type: "string" }, isEnabled: { type: "boolean" }, sortOrder: { type: "integer" },
              },
            },
            example: { isEnabled: true },
          },
        },
      },
      responses: {
        201: ok("Đã thêm", "AdminLanguage"),
        200: ok("Đã sửa", "AdminLanguage"),
        400: E.validation,
        401: E.auth,
        403: E.forbidden,
        409: err("Không tắt được ngôn ngữ dự phòng", "LANGUAGE_REQUIRED", "Tiếng Việt và tiếng Anh là ngôn ngữ dự phòng"),
      },
    },
  },
  "/api/v1/admin/users": {
    get: {
      tags: ["Quản trị người dùng"],
      summary: "Danh sách người dùng (online, hoạt động gần nhất, nhóm)",
      description: "Người đang hoạt động xếp trước, sau đó theo hoạt động gần nhất.",
      security: auth,
      parameters: [
        q("q", { type: "string" }, "Tìm theo email, họ tên"),
        q("role", { type: "string", enum: ["user", "guide", "admin"] }, "Vai trò"),
        q("status", { type: "string", enum: ["active", "locked"] }, "Trạng thái"),
        q("online", { type: "string", enum: ["true", "false"] }, "Đang hoạt động"),
        ...page,
      ],
      responses: { 200: { description: "Trang kết quả", content: { "application/json": { schema: paged("AdminUser") } } }, 400: E.validation, 401: E.auth, 403: E.forbidden },
    },
  },
  "/api/v1/admin/users/{id}": {
    get: {
      tags: ["Quản trị người dùng"],
      summary: "Chi tiết người dùng + 20 phiên gần nhất",
      security: auth,
      parameters: [p("id", { type: "integer" }, "Mã người dùng")],
      responses: { 200: { description: "Chi tiết", content: { "application/json": { schema: { type: "object", properties: { user: { $ref: "#/components/schemas/AdminUser" }, sessions: { type: "array", items: { type: "object" } } } } } } }, 401: E.auth, 403: E.forbidden, 404: E.notFound },
    },
    patch: {
      tags: ["Quản trị người dùng"],
      summary: "Khóa / mở khóa / đổi vai trò",
      description: "`{ status: \"locked\", reason }` thu hồi refresh token, phát `session.revoked` và ngắt socket. `{ status: \"active\" }` mở khóa. `{ role }` đổi vai trò. Không áp dụng cho chính mình.",
      security: auth,
      parameters: [p("id", { type: "integer" }, "Mã người dùng")],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            examples: {
              lock: { summary: "Khóa", value: { status: "locked", reason: "Spam nội dung" } },
              unlock: { summary: "Mở khóa", value: { status: "active" } },
              role: { summary: "Đổi vai trò", value: { role: "guide" } },
            },
          },
        },
      },
      responses: { 200: ok("Sau khi sửa", "AdminUser"), 400: E.validation, 401: E.auth, 403: E.forbidden, 404: E.notFound, 409: err("Sửa chính mình", "CANNOT_MODIFY_SELF", "Không thể khóa hoặc đổi vai trò của chính mình") },
    },
  },
  "/api/v1/admin/tours": {
    get: {
      tags: ["Quản trị người dùng"],
      summary: "Danh sách nhóm tham quan (FE-23)",
      security: auth,
      parameters: [q("status", { type: "string", enum: ["active", "ended"] }, "Trạng thái")],
      responses: { 200: { description: "Danh sách", content: { "application/json": { schema: items("Tour") } } }, 401: E.auth, 403: E.forbidden },
    },
  },
  "/api/v1/admin/activity-logs": {
    get: {
      tags: ["Quản trị người dùng"],
      summary: "Nhật ký hoạt động (FE-24)",
      security: auth,
      parameters: [
        q("userId", { type: "integer" }, "Người thực hiện"),
        q("action", { type: "string", example: "place" }, "Hành động hoặc nhóm hành động (\"place\" khớp mọi place.*)"),
        q("from", { type: "string", format: "date-time" }, "Từ thời điểm (UTC)"),
        q("to", { type: "string", format: "date-time" }, "Đến trước thời điểm (UTC)"),
        ...page,
      ],
      responses: { 200: { description: "Mới nhất trước", content: { "application/json": { schema: paged("ActivityLog") } } }, 400: E.validation, 401: E.auth, 403: E.forbidden },
    },
  },
};
