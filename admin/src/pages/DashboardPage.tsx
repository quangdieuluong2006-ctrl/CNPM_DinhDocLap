import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatCard } from "../components/StatCard";
import { ErrorBox, PageHeader } from "../components/ui";
import { useRealtime } from "../features/realtime/RealtimeProvider";
import { apiGet } from "../lib/api";
import { ACTION_LABEL, shortDay, timeAgo } from "../lib/format";
import type { ActivityLog, Page, StatsResponse } from "../lib/types";

const PIE_COLORS = ["#047857", "#2563eb", "#b45309", "#9333ea", "#db2777", "#0891b2", "#65a30d", "#dc2626", "#7c3aed", "#64748b"];

// FE-17 Dashboard tổng quan (PRD v1.0, mục 7)
export function DashboardPage() {
  const { last } = useRealtime();
  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: () => apiGet<StatsResponse>("/admin/stats"),
    refetchInterval: 60_000,
  });
  const logs = useQuery({
    queryKey: ["stats", "recent-logs"],
    queryFn: () => apiGet<Page<ActivityLog>>("/admin/activity-logs?pageSize=10"),
    refetchInterval: 60_000,
  });

  if (stats.isPending) return <p className="text-slate-500">Đang tải thống kê…</p>;
  if (stats.isError) return <ErrorBox error={stats.error} onRetry={() => void stats.refetch()} />;

  const s = stats.data;
  // Số "Đang hoạt động" lấy từ sự kiện presence.update (realtime) nếu có, nhanh hơn chờ tải lại thống kê
  const activeNow = last?.activeUsers ?? s.activeUsers;

  return (
    <div className="space-y-6">
      <PageHeader title="Tổng quan" subtitle="Số liệu lấy trực tiếp từ SQL Server (EXEC dbo.sp_admin_dashboard_stats). “Hôm nay” tính theo giờ Việt Nam." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Link to="/users">
          <StatCard label="Tổng người dùng" value={s.totalUsers} hint="Khách tham quan + hướng dẫn viên" />
        </Link>
        <Link to="/active-users">
          <StatCard label="Đang hoạt động" value={activeNow} highlight hint="Cập nhật theo thời gian thực" />
        </Link>
        <StatCard label="Lượt tham quan hôm nay" value={s.visitsToday} hint="Không tính lượt mô phỏng" />
        <Link to="/tours">
          <StatCard label="Nhóm đang tham quan" value={s.activeTours} />
        </Link>
        <Link to="/places">
          <StatCard label="Điểm đang xuất bản" value={s.publishedPlaces} />
        </Link>
        <Link to="/places">
          <StatCard label="Bài chờ duyệt" value={s.pendingContents} hint="Bản dịch cần kiểm tra trước khi duyệt" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-medium text-slate-800">Lượt tham quan 7 ngày gần nhất</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.visitsByDay.map((d) => ({ ...d, label: shortDay(d.day) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(v) => [v, "Lượt"]} />
                <Bar dataKey="visits" fill="#047857" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-medium text-slate-800">5 điểm được nghe nhiều nhất (30 ngày)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={s.topPlaces.map((p) => ({ ...p, label: `${p.code} · ${p.title}` }))} margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={190} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [v, "Lượt"]} />
                <Bar dataKey="visits" fill="#b45309" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-medium text-slate-800">Ngôn ngữ được chọn khi nghe (30 ngày)</h2>
          <div className="h-64">
            {s.languages.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có dữ liệu</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={s.languages} dataKey="visits" nameKey="name" outerRadius={90} isAnimationActive={false}>
                    {s.languages.map((l, i) => (
                      <Cell key={l.code} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-slate-800">10 hoạt động gần nhất</h2>
            <Link to="/activity" className="text-sm text-emerald-700 hover:underline">
              Xem tất cả
            </Link>
          </div>
          <ul className="divide-y text-sm">
            {logs.data?.items.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate">
                  <span className="font-medium text-slate-800">{l.user?.fullName ?? "Khách"}</span>{" "}
                  <span className="text-slate-600">{ACTION_LABEL[l.action] ?? l.action}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-400">{timeAgo(l.createdAt)}</span>
              </li>
            ))}
            {logs.data?.items.length === 0 && <li className="py-2 text-slate-500">Chưa có hoạt động</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
