import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { PlacesMap } from "../components/PlacesMap";
import { Badge, ErrorBox, inputCls, PageHeader } from "../components/ui";
import { apiGet } from "../lib/api";
import { PLACE_STATUS_LABEL, TRIGGER_LABEL, ZONE_LABEL } from "../lib/format";
import type { AdminPlace } from "../lib/types";

const STATUS_TONE = { published: "green", draft: "amber", hidden: "slate" } as const;

// FE-20 Quản lý điểm thuyết minh: bản đồ + bảng (gồm cả nháp, đã ẩn).
export function PlacesPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const places = useQuery({ queryKey: ["places"], queryFn: () => apiGet<{ items: AdminPlace[] }>("/admin/places") });

  const all = places.data?.items ?? [];
  const needle = q.trim().toLowerCase();
  const items = all.filter(
    (p) => (!status || p.status === status) && (!needle || p.code.includes(needle) || p.internalName.toLowerCase().includes(needle) || p.slug.includes(needle)),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Điểm thuyết minh"
        subtitle="Vòng tròn là vùng tự động phát (điểm GPS). Điểm trong nhà kích hoạt bằng mã QR / số điểm tại phòng."
        actions={
          <Link to="/places/new" className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800">
            + Thêm điểm
          </Link>
        }
      />
      {places.isError && <ErrorBox error={places.error} onRetry={() => void places.refetch()} />}
      <PlacesMap places={items} onSelect={(p) => navigate(`/places/${p.id}`)} />

      <div className="flex flex-wrap gap-3 text-sm">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo số điểm, tên…" className={`${inputCls} max-w-xs`} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border px-2 py-2">
          <option value="">Mọi trạng thái</option>
          <option value="published">Đang xuất bản</option>
          <option value="draft">Nháp</option>
          <option value="hidden">Đã ẩn</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Số</th>
              <th className="px-4 py-3 font-medium">Tên nội bộ</th>
              <th className="px-4 py-3 font-medium">Khu vực</th>
              <th className="px-4 py-3 font-medium">Kích hoạt</th>
              <th className="px-4 py-3 font-medium">Bài thuyết minh</th>
              <th className="px-4 py-3 text-right font-medium">Lượt nghe</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {places.isPending && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">Đang tải…</td>
              </tr>
            )}
            {items.map((p) => (
              <tr key={p.id} onClick={() => navigate(`/places/${p.id}`)} className="cursor-pointer hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-semibold">{p.code}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{p.internalName}</td>
                <td className="px-4 py-3">{ZONE_LABEL[p.zone]}</td>
                <td className="px-4 py-3 text-slate-600">
                  {TRIGGER_LABEL[p.trigger]}
                  {p.trigger === "gps" && ` · ${p.radiusM} m`}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <Badge tone="green">{p.contents.approved} đã duyệt</Badge>
                    {p.contents.pending > 0 && <Badge tone="blue">{p.contents.pending} chờ duyệt</Badge>}
                    {p.contents.draft > 0 && <Badge tone="amber">{p.contents.draft} nháp</Badge>}
                    {p.contents.withAudio > 0 && <Badge>🔊 {p.contents.withAudio}</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{p.visits}</td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[p.status]}>{PLACE_STATUS_LABEL[p.status]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
