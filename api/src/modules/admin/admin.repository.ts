import { getPool } from "../../db/pool.js";

export interface DashboardStats {
  total_users: number;
  active_users: number;
  visits_today: number;
  active_tours: number;
  published_places: number;
  pending_contents: number;
}

export async function dashboardStats(): Promise<DashboardStats> {
  const pool = await getPool();
  const r = await pool.request().execute<DashboardStats>("dbo.sp_admin_dashboard_stats");
  return r.recordset[0]!;
}

// Lượt tham quan mỗi ngày trong 7 ngày gần nhất (giờ Việt Nam), không tính lượt mô phỏng.
export async function visitsLast7Days(): Promise<{ day: string; visits: number }[]> {
  const pool = await getPool();
  const r = await pool.request().query<{ day: Date; visits: number }>(`
    DECLARE @todayLocal DATE = CAST(SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'SE Asia Standard Time' AS DATE);
    DECLARE @fromUtc DATETIME2(0) = CAST(CAST(DATEADD(DAY, -6, @todayLocal) AS DATETIME2(0))
            AT TIME ZONE 'SE Asia Standard Time' AT TIME ZONE 'UTC' AS DATETIME2(0));
    SELECT CAST(started_at AT TIME ZONE 'UTC' AT TIME ZONE 'SE Asia Standard Time' AS DATE) AS day, COUNT(*) AS visits
    FROM dbo.visits
    WHERE started_at >= @fromUtc AND trigger_type <> 'simulated'
    GROUP BY CAST(started_at AT TIME ZONE 'UTC' AT TIME ZONE 'SE Asia Standard Time' AS DATE);`);
  const byDay = new Map(r.recordset.map((x) => [x.day.toISOString().slice(0, 10), x.visits]));

  // Điền đủ 7 ngày (ngày không có lượt = 0) để biểu đồ không thiếu cột.
  const todayVn = new Date(Date.now() + 7 * 3600_000);
  const out: { day: string; visits: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(todayVn.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ day, visits: byDay.get(day) ?? 0 });
  }
  return out;
}

// 5 điểm được nghe nhiều nhất 30 ngày, tên theo tiếng Việt.
export async function topPlaces(): Promise<{ code: string; title: string; visits: number }[]> {
  const pool = await getPool();
  const r = await pool.request().query<{ code: string; title: string; visits: number }>(`
    SELECT TOP (5) p.code, COALESCE(c.title, p.internal_name) AS title, COUNT(*) AS visits
    FROM dbo.visits v
    JOIN dbo.places p ON p.id = v.place_id
    LEFT JOIN dbo.place_contents c ON c.place_id = p.id AND c.language_code = 'vi'
    WHERE v.trigger_type <> 'simulated' AND v.started_at >= DATEADD(DAY, -30, SYSUTCDATETIME())
    GROUP BY p.code, c.title, p.internal_name
    ORDER BY visits DESC, p.code;`);
  return r.recordset;
}

// Tỷ lệ ngôn ngữ được chọn khi nghe, 30 ngày.
export async function languageShare(): Promise<{ code: string; name: string; visits: number }[]> {
  const pool = await getPool();
  const r = await pool.request().query<{ code: string; name: string; visits: number }>(`
    SELECT l.code, l.name_vi AS name, COUNT(*) AS visits
    FROM dbo.visits v
    JOIN dbo.languages l ON l.code = v.language_code
    WHERE v.trigger_type <> 'simulated' AND v.started_at >= DATEADD(DAY, -30, SYSUTCDATETIME())
    GROUP BY l.code, l.name_vi
    ORDER BY visits DESC;`);
  return r.recordset;
}
