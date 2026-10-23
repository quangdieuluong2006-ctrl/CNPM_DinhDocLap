import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { InviteQrDialog } from "../components/InviteQrDialog";
import { useRealtime } from "../features/realtime/RealtimeProvider";
import { apiGet } from "../lib/api";
import { CLIENT_LABEL, clockTime, timeAgo } from "../lib/format";
import type { ClientType, PresenceResponse } from "../lib/types";

// FE-19: Người dùng đang hoạt động – "làm sao biết có 4 user đang hoạt động?"
export function ActiveUsersPage() {
  const { connected } = useRealtime();
  const [onlyUsers, setOnlyUsers] = useState(true);
  const [client, setClient] = useState<ClientType | "">("");
  const [now, setNow] = useState(() => Date.now());
  const [showQr, setShowQr] = useState(false);

  const params = new URLSearchParams({ role: onlyUsers ? "user" : "all" });
  if (client) params.set("clientType", client);

  const presence = useQuery({
    queryKey: ["presence", onlyUsers, client],
    queryFn: () => apiGet<PresenceResponse>(`/admin/presence?${params.toString()}`),
    // Mất Socket.IO → tự tải lại mỗi 10 giây (PRD FE-19, luồng ngoại lệ)
    refetchInterval: connected ? false : 10_000,
  });

  // Cập nhật cột "Hoạt động cuối" mỗi giây
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const data = presence.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Người dùng đang hoạt động</h1>
          <p className="text-sm text-slate-500">
            Có phiên chưa đóng và gửi nhịp tim trong 60 giây gần nhất. Một người mở nhiều tab/thiết bị chỉ tính 1.
          </p>
        </div>
        <div className="flex items-center gap-4">
        <button
          onClick={() => setShowQr(true)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Mời tham gia (QR)
        </button>
        <div className="rounded-xl border border-emerald-300 bg-white px-6 py-4 text-center shadow-sm">
          <p className="text-sm text-slate-500">Đang hoạt động</p>
          <p data-testid="active-count" className="text-5xl font-bold text-emerald-700">
            {data ? data.count : "–"}
          </p>
        </div>
        </div>
      </div>

      {showQr && <InviteQrDialog onClose={() => setShowQr(false)} />}

      {!connected && (
        <div className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Mất kết nối realtime – danh sách tự làm mới mỗi 10 giây.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={onlyUsers} onChange={(e) => setOnlyUsers(e.target.checked)} />
          Chỉ vai trò người dùng (không tính admin)
        </label>
        <label className="inline-flex items-center gap-2">
          Loại client
          <select value={client} onChange={(e) => setClient(e.target.value as ClientType | "")} className="rounded-md border px-2 py-1">
            <option value="">Tất cả</option>
            <option value="web">Web</option>
            <option value="mobile">Mobile</option>
            <option value="admin">Web Admin</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Họ tên</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium text-right">Số phiên</th>
              <th className="px-4 py-3 font-medium">Trực tuyến từ</th>
              <th className="px-4 py-3 font-medium">Hoạt động cuối</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {presence.isPending && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Đang tải…
                </td>
              </tr>
            )}
            {presence.isError && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-red-700">
                  Không tải được danh sách: {presence.error.message}
                </td>
              </tr>
            )}
            {data && data.users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Hiện chưa có người dùng nào trực tuyến
                </td>
              </tr>
            )}
            {data?.users.map((u) => (
              <tr key={u.userId} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">
                  {u.fullName}
                  {u.role !== "user" && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-700">{u.role === "admin" ? "admin" : "HDV"}</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {u.clientTypes.map((c) => (
                      <span key={c} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                        {CLIENT_LABEL[c] ?? c}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{u.openSessions}</td>
                <td className="px-4 py-3 tabular-nums text-slate-600">{clockTime(u.onlineSince)}</td>
                <td className="px-4 py-3 text-slate-600">{timeAgo(u.lastSeenAt, now)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
