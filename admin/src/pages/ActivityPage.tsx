import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorBox, PageHeader, Pagination } from "../components/ui";
import { apiGet } from "../lib/api";
import { ACTION_LABEL, dateTime } from "../lib/format";
import type { ActivityLog, Page } from "../lib/types";

const GROUPS = [
  ["", "Mọi hành động"],
  ["auth", "Đăng nhập / đăng ký"],
  ["auth.login_failed", "Đăng nhập thất bại"],
  ["place", "Điểm và bài thuyết minh"],
  ["language", "Ngôn ngữ"],
  ["tour", "Nhóm tham quan"],
  ["admin.user", "Quản lý người dùng"],
] as const;

// FE-24 Nhật ký hoạt động: lọc theo nhóm hành động, khoảng thời gian.
export function ActivityPage() {
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: "30" });
  if (action) params.set("action", action);
  // Ngày chọn theo giờ Việt Nam → mốc UTC
  if (from) params.set("from", new Date(`${from}T00:00:00+07:00`).toISOString());
  if (to) params.set("to", new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86_400_000).toISOString());
  const logs = useQuery({ queryKey: ["logs", params.toString()], queryFn: () => apiGet<Page<ActivityLog>>(`/admin/activity-logs?${params}`) });
  const reset = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Nhật ký hoạt động" subtitle="Bảng activity_logs chỉ thêm, không sửa/xóa qua API." />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <select value={action} onChange={(e) => reset(setAction)(e.target.value)} className="rounded-md border px-2 py-2">
          {GROUPS.map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2">
          Từ <input type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} className="rounded-md border px-2 py-1.5" />
        </label>
        <label className="flex items-center gap-2">
          Đến <input type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} className="rounded-md border px-2 py-1.5" />
        </label>
      </div>
      {logs.isError && <ErrorBox error={logs.error} />}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Thời gian</th>
              <th className="px-4 py-3 font-medium">Người thực hiện</th>
              <th className="px-4 py-3 font-medium">Hành động</th>
              <th className="px-4 py-3 font-medium">Chi tiết</th>
              <th className="px-4 py-3 font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.data?.items.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{dateTime(l.createdAt)}</td>
                <td className="px-4 py-2.5">{l.user ? `${l.user.fullName} (${l.user.email})` : <span className="text-slate-400">–</span>}</td>
                <td className="px-4 py-2.5 font-medium">{ACTION_LABEL[l.action] ?? l.action}</td>
                <td className="max-w-md truncate px-4 py-2.5 font-mono text-xs text-slate-500" title={l.detail ? JSON.stringify(l.detail) : ""}>
                  {l.entityType ? `${l.entityType}#${l.entityId ?? ""} ` : ""}
                  {l.detail ? JSON.stringify(l.detail) : ""}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{l.ip ?? "–"}</td>
              </tr>
            ))}
            {logs.data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">Không có bản ghi</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {logs.data && <Pagination page={logs.data.page} pageSize={logs.data.pageSize} total={logs.data.total} onPage={setPage} />}
    </div>
  );
}
