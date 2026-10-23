import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Badge, Button, ErrorBox, Field, inputCls, Modal, PageHeader, Pagination } from "../components/ui";
import { useAuth } from "../features/auth/AuthProvider";
import { apiGet, apiRequest, ApiError } from "../lib/api";
import { CLIENT_LABEL, dateTime, ROLE_LABEL, timeAgo } from "../lib/format";
import type { AdminUser, Page, Role, UserSession } from "../lib/types";

// FE-18 Quản lý người dùng: online/offline, hoạt động gần nhất, nhóm; khóa/mở, đổi vai trò; lịch sử phiên.
export function UsersPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [online, setOnline] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Gõ xong 300 ms mới tìm, tránh gọi API mỗi phím
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const params = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (search) params.set("q", search);
  if (role) params.set("role", role);
  if (status) params.set("status", status);
  if (online) params.set("online", online);
  const users = useQuery({ queryKey: ["users", params.toString()], queryFn: () => apiGet<Page<AdminUser>>(`/admin/users?${params}`) });

  const filter = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Người dùng" subtitle="Người đang hoạt động xếp trước. Trạng thái online cập nhật theo thời gian thực." />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo họ tên, email…" className={`${inputCls} max-w-xs`} />
        <select value={role} onChange={filter(setRole)} className="rounded-md border px-2 py-2">
          <option value="">Mọi vai trò</option>
          <option value="user">Khách tham quan</option>
          <option value="guide">Hướng dẫn viên</option>
          <option value="admin">Quản trị viên</option>
        </select>
        <select value={status} onChange={filter(setStatus)} className="rounded-md border px-2 py-2">
          <option value="">Mọi trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="locked">Đã khóa</option>
        </select>
        <select value={online} onChange={filter(setOnline)} className="rounded-md border px-2 py-2">
          <option value="">Online + offline</option>
          <option value="true">Chỉ online</option>
          <option value="false">Chỉ offline</option>
        </select>
      </div>

      {users.isError && <ErrorBox error={users.error} onRetry={() => void users.refetch()} />}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Họ tên</th>
              <th className="px-4 py-3 font-medium">Vai trò</th>
              <th className="px-4 py-3 font-medium">Trực tuyến</th>
              <th className="px-4 py-3 font-medium">Hoạt động gần nhất</th>
              <th className="px-4 py-3 font-medium">Nhóm tham quan</th>
              <th className="px-4 py-3 text-right font-medium">Lượt nghe</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.isPending && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">Đang tải…</td>
              </tr>
            )}
            {users.data?.items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">Không có người dùng phù hợp</td>
              </tr>
            )}
            {users.data?.items.map((u) => (
              <tr key={u.id} onClick={() => setDetailId(u.id)} className="cursor-pointer hover:bg-slate-50">
                <td className="px-4 py-3 tabular-nums text-slate-500">{u.id}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{u.fullName}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </td>
                <td className="px-4 py-3">{ROLE_LABEL[u.role]}</td>
                <td className="px-4 py-3">
                  {u.online ? (
                    <Badge tone="green">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" /> Online · {u.clientTypes.map((c) => CLIENT_LABEL[c]).join(", ")}
                    </Badge>
                  ) : (
                    <Badge>Offline</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{u.lastSeenAt ? timeAgo(u.lastSeenAt, now) : "Chưa từng"}</td>
                <td className="px-4 py-3">{u.tour ? <Badge tone="blue">{u.tour.code} · {u.tour.name}</Badge> : <span className="text-slate-400">–</span>}</td>
                <td className="px-4 py-3 text-right tabular-nums">{u.visits}</td>
                <td className="px-4 py-3">{u.status === "locked" ? <Badge tone="red">Đã khóa</Badge> : <Badge tone="green">Hoạt động</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.data && <Pagination page={users.data.page} pageSize={users.data.pageSize} total={users.data.total} onPage={setPage} />}
      {detailId !== null && <UserDetail id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function UserDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ["users", "detail", id],
    queryFn: () => apiGet<{ user: AdminUser; sessions: UserSession[] }>(`/admin/users/${id}`),
  });
  const patch = useMutation({
    mutationFn: (body: object) => apiRequest<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      setError(null);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Không lưu được"),
  });

  const u = detail.data?.user;
  const isMe = me?.id === id;
  return (
    <Modal title={u ? u.fullName : "Người dùng"} onClose={onClose} wide>
      {detail.isPending && <p className="text-slate-500">Đang tải…</p>}
      {detail.isError && <ErrorBox error={detail.error} />}
      {u && (
        <div className="space-y-5 text-sm">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            <dt className="text-slate-500">Email</dt>
            <dd>{u.email}</dd>
            <dt className="text-slate-500">Ngày đăng ký</dt>
            <dd>{dateTime(u.createdAt)}</dd>
            <dt className="text-slate-500">Ngôn ngữ thuyết minh</dt>
            <dd>{u.narrationLang?.toUpperCase() ?? "–"}</dd>
            <dt className="text-slate-500">Trạng thái</dt>
            <dd>{u.status === "locked" ? <Badge tone="red">Đã khóa – {u.lockedReason}</Badge> : <Badge tone="green">Hoạt động</Badge>}</dd>
          </dl>

          {isMe ? (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-slate-500">Đây là tài khoản của bạn – không thể tự khóa hoặc đổi vai trò.</p>
          ) : (
            <div className="space-y-3 rounded-lg border p-4">
              <Field label="Vai trò">
                <select
                  value={u.role}
                  disabled={patch.isPending}
                  onChange={(e) => patch.mutate({ role: e.target.value as Role })}
                  className="rounded-md border px-2 py-2"
                >
                  <option value="user">Khách tham quan</option>
                  <option value="guide">Hướng dẫn viên (được tạo nhóm)</option>
                  <option value="admin">Quản trị viên</option>
                </select>
              </Field>
              {u.status === "active" ? (
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Field label="Lý do khóa" hint="Người dùng bị đăng xuất ngay trên mọi thiết bị.">
                      <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} placeholder="Ví dụ: Spam nội dung" />
                    </Field>
                  </div>
                  <Button variant="danger" disabled={!reason.trim() || patch.isPending} onClick={() => patch.mutate({ status: "locked", reason: reason.trim() })} className="mb-5">
                    Khóa tài khoản
                  </Button>
                </div>
              ) : (
                <Button variant="primary" disabled={patch.isPending} onClick={() => patch.mutate({ status: "active" })}>
                  Mở khóa
                </Button>
              )}
              {error && <p className="text-red-600">{error}</p>}
            </div>
          )}

          <div>
            <h3 className="mb-2 font-medium text-slate-800">Lịch sử phiên (20 gần nhất)</h3>
            <table className="min-w-full text-xs">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-1 pr-3">Ứng dụng</th>
                  <th className="py-1 pr-3">Bắt đầu</th>
                  <th className="py-1 pr-3">Kết thúc</th>
                  <th className="py-1 pr-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(detail.data?.sessions ?? []).map((s) => (
                  <tr key={s.id}>
                    <td className="py-1.5 pr-3">{CLIENT_LABEL[s.clientType]}</td>
                    <td className="py-1.5 pr-3">{dateTime(s.connectedAt)}</td>
                    <td className="py-1.5 pr-3">{s.disconnectedAt ? dateTime(s.disconnectedAt) : <Badge tone="green">Đang mở</Badge>}</td>
                    <td className="py-1.5 pr-3 font-mono">{s.ip ?? "–"}</td>
                  </tr>
                ))}
                {detail.data?.sessions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-2 text-slate-500">Chưa có phiên nào</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
