import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, ErrorBox, PageHeader } from "../components/ui";
import { apiGet } from "../lib/api";
import { dateTime } from "../lib/format";
import type { Tour } from "../lib/types";

// FE-23 Nhóm tham quan: hướng dẫn viên tạo nhóm trên Mobile, khách tham gia bằng mã 6 ký tự.
export function ToursPage() {
  const [status, setStatus] = useState("");
  const tours = useQuery({
    queryKey: ["tours", status],
    queryFn: () => apiGet<{ items: Tour[] }>(`/admin/tours${status ? `?status=${status}` : ""}`),
    refetchInterval: 15_000,
  });
  return (
    <div className="space-y-5">
      <PageHeader title="Nhóm tham quan" subtitle="Thành viên trong nhóm chỉ chia sẻ điểm đang nghe, không chia sẻ tọa độ GPS." />
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border px-2 py-2 text-sm">
        <option value="">Tất cả</option>
        <option value="active">Đang tham quan</option>
        <option value="ended">Đã kết thúc</option>
      </select>
      {tours.isError && <ErrorBox error={tours.error} />}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Mã nhóm</th>
              <th className="px-4 py-3 font-medium">Tên nhóm</th>
              <th className="px-4 py-3 font-medium">Hướng dẫn viên</th>
              <th className="px-4 py-3 text-right font-medium">Thành viên</th>
              <th className="px-4 py-3 font-medium">Tạo lúc</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tours.data?.items.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-mono font-semibold tracking-wider">{t.code}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                <td className="px-4 py-3">{t.guide.fullName}</td>
                <td className="px-4 py-3 text-right tabular-nums">{t.memberCount}/{t.maxMembers}</td>
                <td className="px-4 py-3 text-slate-600">{dateTime(t.createdAt)}</td>
                <td className="px-4 py-3">{t.status === "active" ? <Badge tone="green">Đang tham quan</Badge> : <Badge>Đã kết thúc</Badge>}</td>
              </tr>
            ))}
            {tours.data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">Chưa có nhóm nào</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
