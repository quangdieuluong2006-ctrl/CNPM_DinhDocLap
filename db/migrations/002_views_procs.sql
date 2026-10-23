-- 002_views_procs.sql: view và stored procedure cho presence, Dashboard, nội dung (PRD v1.0, mục 13.3).
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- Người dùng đang hoạt động: còn phiên chưa đóng và có nhịp tim trong 60 giây gần nhất.
-- Một người mở nhiều tab/thiết bị chỉ là MỘT dòng.
CREATE OR ALTER VIEW dbo.v_active_users AS
SELECT s.user_id, u.full_name, u.email, u.role,
       MAX(s.last_seen_at) AS last_seen_at,
       MIN(s.connected_at) AS online_since,
       COUNT(*)            AS open_sessions,
       MAX(CASE WHEN s.client_type = 'mobile' THEN 1 ELSE 0 END) AS on_mobile,
       MAX(CASE WHEN s.client_type = 'web'    THEN 1 ELSE 0 END) AS on_web,
       MAX(CASE WHEN s.client_type = 'admin'  THEN 1 ELSE 0 END) AS on_admin
FROM dbo.user_sessions s
JOIN dbo.users u ON u.id = s.user_id
WHERE s.disconnected_at IS NULL
  AND s.last_seen_at > DATEADD(SECOND, -60, SYSUTCDATETIME())
GROUP BY s.user_id, u.full_name, u.email, u.role;
GO

-- Thời điểm hoạt động gần nhất của mỗi người (cột "hoạt động gần nhất" trong Quản lý người dùng).
CREATE OR ALTER VIEW dbo.v_user_last_seen AS
SELECT user_id, MAX(last_seen_at) AS last_seen_at, COUNT(*) AS total_sessions
FROM dbo.user_sessions
GROUP BY user_id;
GO

-- Thống kê theo điểm, không tính lượt mô phỏng.
CREATE OR ALTER VIEW dbo.v_place_stats AS
SELECT p.id AS place_id, p.code, p.internal_name,
       COUNT(v.id) AS visits,
       COUNT(DISTINCT v.user_id) AS listeners,
       SUM(CASE WHEN v.completed = 1 THEN 1 ELSE 0 END) AS completed_visits
FROM dbo.places p
LEFT JOIN dbo.visits v ON v.place_id = p.id AND v.trigger_type <> 'simulated'
GROUP BY p.id, p.code, p.internal_name;
GO

-- Mức hoàn thiện nội dung theo ngôn ngữ trên các điểm đang xuất bản.
CREATE OR ALTER VIEW dbo.v_language_completeness AS
SELECT l.code,
       (SELECT COUNT(*) FROM dbo.places p WHERE p.status = 'published') AS published_places,
       SUM(CASE WHEN c.status = 'approved' THEN 1 ELSE 0 END) AS approved,
       SUM(CASE WHEN c.status = 'pending'  THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN c.status = 'draft'    THEN 1 ELSE 0 END) AS draft
FROM dbo.languages l
LEFT JOIN dbo.place_contents c ON c.language_code = l.code
  AND c.place_id IN (SELECT id FROM dbo.places WHERE status = 'published')
GROUP BY l.code;
GO

-- 6 số liệu Dashboard; "hôm nay" tính theo giờ Việt Nam.
CREATE OR ALTER PROCEDURE dbo.sp_admin_dashboard_stats AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @todayLocal DATE = CAST(SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'SE Asia Standard Time' AS DATE);
  DECLARE @todayUtc DATETIME2(0) = CAST(CAST(@todayLocal AS DATETIME2(0))
          AT TIME ZONE 'SE Asia Standard Time' AT TIME ZONE 'UTC' AS DATETIME2(0));
  SELECT
    (SELECT COUNT(*) FROM dbo.users WHERE role <> 'admin') AS total_users,
    (SELECT COUNT(*) FROM dbo.v_active_users WHERE role <> 'admin') AS active_users,
    (SELECT COUNT(*) FROM dbo.visits WHERE started_at >= @todayUtc AND trigger_type <> 'simulated') AS visits_today,
    (SELECT COUNT(*) FROM dbo.tours WHERE status = 'active') AS active_tours,
    (SELECT COUNT(*) FROM dbo.places WHERE status = 'published') AS published_places,
    (SELECT COUNT(*) FROM dbo.place_contents WHERE status = 'pending') AS pending_contents;
END;
GO

-- Xuất bản nội dung: thêm một phiên bản mới, trả về số phiên bản.
CREATE OR ALTER PROCEDURE dbo.sp_publish_content @published_by INT = NULL, @note NVARCHAR(300) = NULL AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO dbo.content_releases (published_by, note) VALUES (@published_by, @note);
  SELECT CAST(SCOPE_IDENTITY() AS INT) AS version;
END;
GO
