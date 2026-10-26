import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BookOpenCheck,
  Footprints,
  Flag,
  KeyRound,
  Languages,
  LogIn,
  MapPin,
  Pencil,
  ShieldAlert,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PalaceArt } from "../components/PalaceArt";
import { StatCard } from "../components/StatCard";
import { ErrorBox } from "../components/ui";
import { useAuth } from "../features/auth/AuthProvider";
import { useRealtime } from "../features/realtime/RealtimeProvider";
import { apiGet } from "../lib/api";
import { ACTION_LABEL, shortDay, timeAgo } from "../lib/format";
import type { ActivityLog, Page, StatsResponse } from "../lib/types";

const PIE_COLORS = ["#047857", "#2563eb", "#b45309", "#9333ea", "#db2777", "#0891b2", "#65a30d", "#dc2626", "#7c3aed", "#64748b"];

// Biểu tượng cho từng loại hoạt động trong nhật ký
const ACTION_ICON: { prefix: string; icon: LucideIcon; cls: string }[] = [
  { prefix: "auth.login_failed", icon: ShieldAlert, cls: "bg-red-100 text-red-600" },
  { prefix: "auth.refresh_reuse", icon: ShieldAlert, cls: "bg-red-100 text-red-600" },
  { prefix: "auth.register", icon: UserPlus, cls: "bg-sky-100 text-sky-700" },
  { prefix: "auth.", icon: LogIn, cls: "bg-emerald-100 text-emerald-700" },
  { prefix: "tour.", icon: Flag, cls: "bg-amber-100 text-amber-700" },
  { prefix: "content.", icon: BookOpenCheck, cls: "bg-violet-100 text-violet-700" },
  { prefix: "place.", icon: Pencil, cls: "bg-teal-100 text-teal-700" },
  { prefix: "language.", icon: Languages, cls: "bg-indigo-100 text-indigo-700" },
  { prefix: "admin.", icon: KeyRound, cls: "bg-rose-100 text-rose-700" },
];
function actionIcon(action: string) {
  return ACTION_ICON.find((a) => action.startsWith(a.prefix)) ?? { icon: Activity, cls: "bg-slate-100 text-slate-600" };
}

function greeting(now = new Date()): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Ho_Chi_Minh" }).format(now));
  return h < 11 ? "Chào buổi sáng" : h < 14 ? "Chào buổi trưa" : h < 18 ? "Chào buổi chiều" : "Chào buổi tối";
}

function Panel(props: { title: string; action?: ReactNode; children: ReactNode; delayMs: number }) {
  return (
    <section style={{ animationDelay: `${props.delayMs}ms` }} className="animate-fade-up rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-medium text-slate-800">{props.title}</h2>
        {props.action}
      </div>
      {props.children}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Đang tải thống kê…">
      <div className="skeleton h-40" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="skeleton h-80" />
        <div className="skeleton h-80" />
      </div>
    </div>
  );
}

// FE-17 Dashboard tổng quan (PRD v1.0, mục 7)
export function DashboardPage() {
  const { user } = useAuth();
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

  if (stats.isPending) return <DashboardSkeleton />;
  if (stats.isError) return <ErrorBox error={stats.error} onRetry={() => void stats.refetch()} />;

  const s = stats.data;
  // Số "Đang hoạt động" lấy từ sự kiện presence.update (realtime) nếu có, nhanh hơn chờ tải lại thống kê
  const activeNow = last?.activeUsers ?? s.activeUsers;
  const totalLangVisits = s.languages.reduce((sum, l) => sum + l.visits, 0);
  const today = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950 px-6 py-6 text-white shadow-lg sm:px-8">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-400/10 blur-2xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="text-sm capitalize text-emerald-200">{today}</p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
              {greeting()}, {user?.fullName ?? "quản trị viên"} 👋
            </h1>
            <p className="mt-2 text-sm text-emerald-100/80">
              Số liệu lấy trực tiếp từ SQL Server (EXEC dbo.sp_admin_dashboard_stats). “Hôm nay” tính theo giờ Việt Nam.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <Link to="/active-users" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur transition hover:bg-white/20">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                </span>
                {activeNow} người đang dùng ứng dụng
              </Link>
              {s.pendingContents > 0 && (
                <Link to="/places" className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 px-3 py-1.5 text-amber-100 transition hover:bg-amber-400/30">
                  <BookOpenCheck size={15} /> {s.pendingContents} bài chờ duyệt
                </Link>
              )}
            </div>
          </div>
          <PalaceArt className="w-full max-w-sm shrink-0 animate-fade-in text-emerald-100" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Link to="/users">
          <StatCard label="Tổng người dùng" value={s.totalUsers} hint="Khách tham quan + hướng dẫn viên" icon={Users} tone="sky" delayMs={0} />
        </Link>
        <Link to="/active-users">
          <StatCard label="Đang hoạt động" value={activeNow} highlight hint="Cập nhật theo thời gian thực" icon={Activity} tone="emerald" delayMs={60} />
        </Link>
        <StatCard label="Lượt tham quan hôm nay" value={s.visitsToday} hint="Không tính lượt mô phỏng" icon={Footprints} tone="amber" delayMs={120} />
        <Link to="/tours">
          <StatCard label="Nhóm đang tham quan" value={s.activeTours} hint="Đoàn có hướng dẫn viên" icon={Flag} tone="rose" delayMs={180} />
        </Link>
        <Link to="/places">
          <StatCard label="Điểm đang xuất bản" value={s.publishedPlaces} hint="Ngoài trời (GPS) + trong nhà (QR)" icon={MapPin} tone="teal" delayMs={240} />
        </Link>
        <Link to="/places">
          <StatCard label="Bài chờ duyệt" value={s.pendingContents} hint="Bản dịch cần kiểm tra trước khi duyệt" icon={BookOpenCheck} tone="violet" delayMs={300} />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Lượt tham quan 7 ngày gần nhất" delayMs={150}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={s.visitsByDay.map((d) => ({ ...d, label: shortDay(d.day) }))} margin={{ left: -16, right: 8 }}>
                <defs>
                  <linearGradient id="visitsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [v, "Lượt"]} contentStyle={{ borderRadius: 12 }} />
                <Area type="monotone" dataKey="visits" stroke="#047857" strokeWidth={2.5} fill="url(#visitsFill)" dot={{ r: 4, fill: "#047857" }} activeDot={{ r: 6 }} animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="5 điểm được nghe nhiều nhất (30 ngày)" delayMs={200}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={s.topPlaces.map((p) => ({ ...p, label: `${p.code} · ${p.title}` }))} margin={{ left: 20 }}>
                <defs>
                  <linearGradient id="topFill" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#b45309" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" width={190} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [v, "Lượt"]} cursor={{ fill: "#fef3c7" }} contentStyle={{ borderRadius: 12 }} />
                <Bar dataKey="visits" fill="url(#topFill)" radius={[0, 8, 8, 0]} barSize={22} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Ngôn ngữ được chọn khi nghe (30 ngày)" delayMs={250}>
          {s.languages.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có dữ liệu</p>
          ) : (
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <div className="relative h-56 w-56 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={s.languages} dataKey="visits" nameKey="name" innerRadius={62} outerRadius={100} paddingAngle={2} cornerRadius={4} animationDuration={900}>
                      {s.languages.map((l, i) => (
                        <Cell key={l.code} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-semibold tabular-nums text-slate-900">{totalLangVisits}</span>
                  <span className="text-xs text-slate-500">lượt nghe</span>
                </div>
              </div>
              <ul className="w-full space-y-2 text-sm">
                {s.languages.map((l, i) => {
                  const pct = totalLangVisits ? Math.round((l.visits / totalLangVisits) * 100) : 0;
                  return (
                    <li key={l.code}>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          {l.name}
                        </span>
                        <span className="tabular-nums text-slate-500">{pct}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Panel>

        <Panel
          title="10 hoạt động gần nhất"
          delayMs={300}
          action={
            <Link to="/activity" className="text-sm text-emerald-700 hover:underline">
              Xem tất cả →
            </Link>
          }
        >
          <ul className="space-y-1 text-sm">
            {logs.data?.items.map((l, i) => {
              const { icon: Icon, cls } = actionIcon(l.action);
              return (
                <li key={l.id} style={{ animationDelay: `${300 + i * 40}ms` }} className="flex animate-fade-up items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cls}`}>
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-slate-800">{l.user?.fullName ?? "Khách"}</span>{" "}
                    <span className="text-slate-600">{ACTION_LABEL[l.action] ?? l.action}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{timeAgo(l.createdAt)}</span>
                </li>
              );
            })}
            {logs.data?.items.length === 0 && <li className="py-2 text-slate-500">Chưa có hoạt động</li>}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
