-- 001_init.sql: lược đồ CSDL thuyết minh đa ngôn ngữ theo vị trí (PRD v1.0, mục 13).
-- Filtered index yêu cầu hai tùy chọn SET này (sqlcmd mặc định tắt QUOTED_IDENTIFIER).
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- Ngôn ngữ thuyết minh đã thêm vào hệ thống (mã ISO 639-1).
CREATE TABLE dbo.languages (
  code        VARCHAR(10)   NOT NULL CONSTRAINT PK_languages PRIMARY KEY,
  name_vi     NVARCHAR(60)  NOT NULL,
  name_en     NVARCHAR(60)  NOT NULL,
  name_native NVARCHAR(60)  NOT NULL,
  tts_locale  VARCHAR(20)   NOT NULL,      -- mã BCP 47 cho giọng tổng hợp, ví dụ ja-JP
  is_enabled  BIT           NOT NULL CONSTRAINT DF_languages_enabled DEFAULT 1,
  sort_order  INT           NOT NULL CONSTRAINT DF_languages_sort DEFAULT 100
);
GO

CREATE TABLE dbo.users (
  id             INT IDENTITY(1,1) CONSTRAINT PK_users PRIMARY KEY,
  email          NVARCHAR(255) NOT NULL CONSTRAINT UQ_users_email UNIQUE,
  password_hash  NVARCHAR(255) NULL,
  full_name      NVARCHAR(100) NOT NULL,
  role           VARCHAR(10)   NOT NULL CONSTRAINT DF_users_role DEFAULT 'user'
                 CONSTRAINT CK_users_role CHECK (role IN ('user', 'guide', 'admin')),
  status         VARCHAR(10)   NOT NULL CONSTRAINT DF_users_status DEFAULT 'active'
                 CONSTRAINT CK_users_status CHECK (status IN ('active', 'locked')),
  locked_reason  NVARCHAR(300) NULL,
  ui_locale      VARCHAR(5)    NOT NULL CONSTRAINT DF_users_ui_locale DEFAULT 'vi'
                 CONSTRAINT CK_users_ui_locale CHECK (ui_locale IN ('vi', 'en')),
  narration_lang VARCHAR(10)   NULL CONSTRAINT FK_users_narration_lang REFERENCES dbo.languages(code),
  created_at     DATETIME2(0)  NOT NULL CONSTRAINT DF_users_created DEFAULT SYSUTCDATETIME(),
  updated_at     DATETIME2(0)  NULL
);
GO

CREATE TABLE dbo.refresh_tokens (
  id         INT IDENTITY(1,1) CONSTRAINT PK_refresh_tokens PRIMARY KEY,
  user_id    INT NOT NULL CONSTRAINT FK_refresh_tokens_users REFERENCES dbo.users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL CONSTRAINT UQ_refresh_tokens_hash UNIQUE,
  expires_at DATETIME2(0) NOT NULL,
  revoked_at DATETIME2(0) NULL,
  created_at DATETIME2(0) NOT NULL CONSTRAINT DF_refresh_tokens_created DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_refresh_tokens_user ON dbo.refresh_tokens(user_id);
GO

-- Nguồn dữ liệu presence: mỗi dòng là một kết nối realtime (tab/ứng dụng) của một người dùng.
CREATE TABLE dbo.user_sessions (
  id              BIGINT IDENTITY(1,1) CONSTRAINT PK_user_sessions PRIMARY KEY,
  user_id         INT NOT NULL CONSTRAINT FK_sessions_users REFERENCES dbo.users(id) ON DELETE CASCADE,
  client_type     VARCHAR(10) NOT NULL
                  CONSTRAINT CK_sessions_client CHECK (client_type IN ('web', 'admin', 'mobile')),
  socket_id       VARCHAR(64)   NULL,
  ip_address      VARCHAR(45)   NULL,
  user_agent      NVARCHAR(300) NULL,
  connected_at    DATETIME2(0) NOT NULL CONSTRAINT DF_sessions_conn DEFAULT SYSUTCDATETIME(),
  last_seen_at    DATETIME2(0) NOT NULL CONSTRAINT DF_sessions_seen DEFAULT SYSUTCDATETIME(),
  disconnected_at DATETIME2(0) NULL
);
GO
-- Filtered index: chỉ chứa phiên đang mở nên đếm người đang hoạt động rất nhanh.
CREATE INDEX IX_sessions_open ON dbo.user_sessions(last_seen_at)
  INCLUDE (user_id, client_type) WHERE disconnected_at IS NULL;
CREATE INDEX IX_sessions_user ON dbo.user_sessions(user_id, connected_at DESC);
GO

-- Nhật ký chỉ thêm, không sửa/xóa qua API.
CREATE TABLE dbo.activity_logs (
  id          BIGINT IDENTITY(1,1) CONSTRAINT PK_activity_logs PRIMARY KEY,
  user_id     INT NULL CONSTRAINT FK_logs_users REFERENCES dbo.users(id),
  action      VARCHAR(50) NOT NULL,
  entity_type VARCHAR(30) NULL,
  entity_id   INT NULL,
  ip_address  VARCHAR(45) NULL,
  detail      NVARCHAR(MAX) NULL CONSTRAINT CK_logs_detail_json CHECK (detail IS NULL OR ISJSON(detail) = 1),
  created_at  DATETIME2(0) NOT NULL CONSTRAINT DF_logs_created DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_logs_created ON dbo.activity_logs(created_at DESC);
CREATE INDEX IX_logs_user ON dbo.activity_logs(user_id, created_at DESC);
GO

-- Điểm thuyết minh. "trigger" là từ khóa của SQL Server nên cột tên trigger_type.
CREATE TABLE dbo.places (
  id            INT IDENTITY(1,1) CONSTRAINT PK_places PRIMARY KEY,
  code          CHAR(3) NOT NULL CONSTRAINT UQ_places_code UNIQUE
                CONSTRAINT CK_places_code CHECK (code LIKE '[0-9][0-9][0-9]'),
  slug          VARCHAR(80) NOT NULL CONSTRAINT UQ_places_slug UNIQUE,
  internal_name NVARCHAR(120) NOT NULL,
  trigger_type  VARCHAR(10) NOT NULL CONSTRAINT CK_places_trigger CHECK (trigger_type IN ('gps', 'indoor')),
  zone          VARCHAR(12) NOT NULL
                CONSTRAINT CK_places_zone CHECK (zone IN ('outdoor', 'ground', 'floor1', 'floor2', 'rooftop', 'basement')),
  lat           DECIMAL(9,6) NOT NULL CONSTRAINT CK_places_lat CHECK (lat BETWEEN -90 AND 90),
  lng           DECIMAL(9,6) NOT NULL CONSTRAINT CK_places_lng CHECK (lng BETWEEN -180 AND 180),
  radius_m      SMALLINT NOT NULL CONSTRAINT DF_places_radius DEFAULT 25
                CONSTRAINT CK_places_radius CHECK (radius_m BETWEEN 15 AND 80),
  priority      SMALLINT NOT NULL CONSTRAINT DF_places_priority DEFAULT 0,
  sort_order    INT NOT NULL CONSTRAINT DF_places_sort DEFAULT 0,
  image_url     NVARCHAR(500) NULL,
  status        VARCHAR(10) NOT NULL CONSTRAINT DF_places_status DEFAULT 'draft'
                CONSTRAINT CK_places_status CHECK (status IN ('draft', 'published', 'hidden')),
  created_at    DATETIME2(0) NOT NULL CONSTRAINT DF_places_created DEFAULT SYSUTCDATETIME(),
  updated_at    DATETIME2(0) NULL
);
GO

-- Bài thuyết minh của một điểm trong một ngôn ngữ.
CREATE TABLE dbo.place_contents (
  id                 INT IDENTITY(1,1) CONSTRAINT PK_place_contents PRIMARY KEY,
  place_id           INT NOT NULL CONSTRAINT FK_contents_places REFERENCES dbo.places(id) ON DELETE CASCADE,
  language_code      VARCHAR(10) NOT NULL CONSTRAINT FK_contents_languages REFERENCES dbo.languages(code),
  title              NVARCHAR(120) NOT NULL,
  summary            NVARCHAR(300) NOT NULL,
  body               NVARCHAR(MAX) NOT NULL CONSTRAINT CK_contents_body_len CHECK (LEN(body) <= 5000),
  audio_url          NVARCHAR(500) NULL,
  audio_duration_sec INT NULL,
  audio_bytes        INT NULL,
  status             VARCHAR(10) NOT NULL CONSTRAINT DF_contents_status DEFAULT 'draft'
                     CONSTRAINT CK_contents_status CHECK (status IN ('draft', 'pending', 'approved')),
  source             VARCHAR(10) NOT NULL CONSTRAINT DF_contents_source DEFAULT 'human'
                     CONSTRAINT CK_contents_source CHECK (source IN ('human', 'machine')),
  updated_by         INT NULL CONSTRAINT FK_contents_users REFERENCES dbo.users(id),
  updated_at         DATETIME2(0) NOT NULL CONSTRAINT DF_contents_updated DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_contents_place_lang UNIQUE (place_id, language_code)
);
GO

-- Mỗi lần xuất bản nội dung thêm một dòng; version lớn nhất là phiên bản hiện tại của gói offline.
CREATE TABLE dbo.content_releases (
  version      INT IDENTITY(1,1) CONSTRAINT PK_content_releases PRIMARY KEY,
  published_by INT NULL CONSTRAINT FK_releases_users REFERENCES dbo.users(id),
  published_at DATETIME2(0) NOT NULL CONSTRAINT DF_releases_at DEFAULT SYSUTCDATETIME(),
  note         NVARCHAR(300) NULL
);
GO

CREATE TABLE dbo.tours (
  id          INT IDENTITY(1,1) CONSTRAINT PK_tours PRIMARY KEY,
  code        CHAR(6) NOT NULL CONSTRAINT UQ_tours_code UNIQUE,
  name        NVARCHAR(100) NOT NULL,
  guide_id    INT NOT NULL CONSTRAINT FK_tours_guide REFERENCES dbo.users(id),
  status      VARCHAR(10) NOT NULL CONSTRAINT DF_tours_status DEFAULT 'active'
              CONSTRAINT CK_tours_status CHECK (status IN ('active', 'ended')),
  max_members SMALLINT NOT NULL CONSTRAINT DF_tours_max DEFAULT 50,
  created_at  DATETIME2(0) NOT NULL CONSTRAINT DF_tours_created DEFAULT SYSUTCDATETIME(),
  ended_at    DATETIME2(0) NULL
);
GO

-- Không dùng CASCADE ở đây: users → tours → tour_members và users → tour_members tạo nhiều đường cascade.
CREATE TABLE dbo.tour_members (
  id               INT IDENTITY(1,1) CONSTRAINT PK_tour_members PRIMARY KEY,
  tour_id          INT NOT NULL CONSTRAINT FK_members_tours REFERENCES dbo.tours(id),
  user_id          INT NOT NULL CONSTRAINT FK_members_users REFERENCES dbo.users(id),
  joined_at        DATETIME2(0) NOT NULL CONSTRAINT DF_members_joined DEFAULT SYSUTCDATETIME(),
  left_at          DATETIME2(0) NULL,
  current_place_id INT NULL CONSTRAINT FK_members_places REFERENCES dbo.places(id),
  current_place_at DATETIME2(0) NULL
);
GO
-- Một người chỉ ở một nhóm chưa rời tại một thời điểm.
CREATE UNIQUE INDEX UX_members_one_active ON dbo.tour_members(user_id) WHERE left_at IS NULL;
CREATE INDEX IX_members_tour ON dbo.tour_members(tour_id) INCLUDE (user_id, left_at, current_place_id);
GO

-- Lượt ghé: một lần khách bắt đầu nghe thuyết minh tại một điểm. client_id do thiết bị sinh để bỏ trùng khi đồng bộ.
CREATE TABLE dbo.visits (
  id            BIGINT IDENTITY(1,1) CONSTRAINT PK_visits PRIMARY KEY,
  client_id     UNIQUEIDENTIFIER NOT NULL CONSTRAINT UQ_visits_client UNIQUE,
  user_id       INT NULL CONSTRAINT FK_visits_users REFERENCES dbo.users(id),
  place_id      INT NOT NULL CONSTRAINT FK_visits_places REFERENCES dbo.places(id),
  language_code VARCHAR(10) NOT NULL CONSTRAINT FK_visits_languages REFERENCES dbo.languages(code),
  trigger_type  VARCHAR(10) NOT NULL
                CONSTRAINT CK_visits_trigger CHECK (trigger_type IN ('gps', 'qr', 'code', 'manual', 'simulated')),
  listened_sec  INT NOT NULL CONSTRAINT DF_visits_listened DEFAULT 0 CONSTRAINT CK_visits_listened CHECK (listened_sec >= 0),
  completed     BIT NOT NULL CONSTRAINT DF_visits_completed DEFAULT 0,
  started_at    DATETIME2(0) NOT NULL,
  created_at    DATETIME2(0) NOT NULL CONSTRAINT DF_visits_created DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_visits_place ON dbo.visits(place_id, started_at);
CREATE INDEX IX_visits_user ON dbo.visits(user_id, started_at);
CREATE INDEX IX_visits_started ON dbo.visits(started_at) INCLUDE (trigger_type, language_code, place_id);
GO
