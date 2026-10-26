-- 003_guest_visitors.sql: khách tham quan dùng ngay không cần đăng ký (khách ẩn danh).
-- Mở web/app lần đầu → API tự tạo một tài khoản khách (is_guest = 1, không mật khẩu) gắn với thiết bị đó,
-- nhờ vậy lượt nghe, lịch sử và presence ("Đang hoạt động") vẫn hoạt động như người dùng thường.
-- Email của khách là địa chỉ nội bộ guest-<uuid>@guest.local (giữ nguyên ràng buộc UNIQUE), không ai đăng nhập được
-- vì password_hash = NULL.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

ALTER TABLE dbo.users ADD is_guest BIT NOT NULL CONSTRAINT DF_users_is_guest DEFAULT 0;
GO

CREATE OR ALTER VIEW dbo.v_active_users AS
SELECT s.user_id, u.full_name, u.email, u.role, u.is_guest,
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
GROUP BY s.user_id, u.full_name, u.email, u.role, u.is_guest;
GO
