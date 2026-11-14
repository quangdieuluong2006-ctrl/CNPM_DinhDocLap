-- 004_drop_tours.sql: bỏ hẳn nhóm tham quan và vai trò hướng dẫn viên (PRD v2.0, mục 13.4).
-- Từ v1.1 giao diện đã bỏ nhóm tham quan; v2.0 xóa nốt phần CSDL để lược đồ khớp PRD:
--   10 bảng (9 bảng nghiệp vụ + schema_migrations), 2 vai trò user / admin.
-- Dữ liệu bị xóa chỉ là dữ liệu nhóm tham quan (tours, tour_members); người dùng, lượt ghé, nội dung giữ nguyên.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Xóa bảng con trước (tour_members tham chiếu tours, users, places), rồi đến bảng cha.
DROP TABLE IF EXISTS dbo.tour_members;
DROP TABLE IF EXISTS dbo.tours;
GO

-- 2. Hướng dẫn viên còn sót (nếu có) trở thành người dùng thường, rồi siết lại ràng buộc vai trò.
UPDATE dbo.users SET role = 'user', updated_at = SYSUTCDATETIME() WHERE role NOT IN ('user', 'admin');
ALTER TABLE dbo.users DROP CONSTRAINT CK_users_role;
ALTER TABLE dbo.users ADD CONSTRAINT CK_users_role CHECK (role IN ('user', 'admin'));
GO

-- 3. Dashboard: bỏ cột active_tours (FE-17 còn 5 thẻ).
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
    (SELECT COUNT(*) FROM dbo.places WHERE status = 'published') AS published_places,
    (SELECT COUNT(*) FROM dbo.place_contents WHERE status = 'pending') AS pending_contents;
END;
GO
