import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { Badge, Button, ErrorBox, PageHeader } from "../components/ui";
import { apiGet, apiRequest } from "../lib/api";
import { dateTime } from "../lib/format";
import type { Tour } from "../lib/types";

interface TourMember {
  userId: number;
  fullName: string;
  isGuide: boolean;
  online: boolean;
  currentPlaceCode: string | null;
  currentPlaceAt: string | null;
}

// FE-23 Nhóm tham quan: danh sách nhóm, thành viên (trực tuyến, điểm đang nghe), kết thúc nhóm.
// Hướng dẫn viên tạo nhóm trên Mobile, khách tham gia bằng mã 6 ký tự.
export function ToursPage() {
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const tours = useQuery({
    queryKey: ["tours", status],
    queryFn: () => apiGet<{ items: Tour[] }>(`/admin/tours${status ? `?status=${status}` : ""}`),
    refetchInterval: 15_000,
  });
  return (
    <div className="space-y-5">
      <PageHeader title="Nhóm tham quan" subtitle="Thành viên trong nhóm chỉ chia sẻ điểm đang nghe, không chia sẻ tọa độ GPS. Bấm một nhóm để xem thành viên." />
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
              <Fragment key={t.id}>
                <tr onClick={() => setOpen(open === t.id ? null : t.id)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-semibold tracking-wider">
                    <span className="mr-2 text-slate-400">{open === t.id ? "▾" : "▸"}</span>
                    {t.code}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                  <td className="px-4 py-3">{t.guide.fullName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {t.memberCount}/{t.maxMembers}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{dateTime(t.createdAt)}</td>
                  <td className="px-4 py-3">{t.status === "active" ? <Badge tone="green">Đang tham quan</Badge> : <Badge>Đã kết thúc</Badge>}</td>
                </tr>
                {open === t.id && (
                  <tr>
                    <td colSpan={6} className="bg-slate-50 px-6 py-4">
                      <TourDetail tour={t} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {tours.data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Chưa có nhóm nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TourDetail({ tour }: { tour: Tour }) {
  const qc = useQueryClient();
  const members = useQuery({
    queryKey: ["tours", "members", tour.id],
    queryFn: () => apiGet<{ members: TourMember[] }>(`/tours/${tour.id}/members`),
    enabled: tour.status === "active",
    refetchInterval: 10_000,
  });
  const end = useMutation({
    mutationFn: () => apiRequest<void>(`/tours/${tour.id}/end`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tours"] }),
  });

  if (tour.status === "ended") {
    return <p className="text-sm text-slate-500">Nhóm đã kết thúc{tour.endedAt ? ` lúc ${dateTime(tour.endedAt)}` : ""}.</p>;
  }
  return (
    <div className="space-y-3 text-sm">
      {members.isError && <ErrorBox error={members.error} />}
      <ul className="divide-y rounded-lg border bg-white">
        {members.data?.members.map((m) => (
          <li key={m.userId} className="flex items-center gap-3 px-4 py-2.5">
            <span className={`h-2.5 w-2.5 rounded-full ${m.online ? "bg-emerald-500" : "bg-slate-300"}`} />
            <span className="flex-1">
              <span className="font-medium text-slate-900">{m.fullName}</span>
              {m.isGuide && <span className="ml-2"><Badge tone="amber">Hướng dẫn viên</Badge></span>}
            </span>
            <span className="text-slate-500">{m.currentPlaceCode ? `đang nghe điểm ${m.currentPlaceCode}` : m.online ? "trực tuyến" : "ngoại tuyến"}</span>
          </li>
        ))}
      </ul>
      <Button
        variant="danger"
        disabled={end.isPending}
        onClick={() => window.confirm(`Kết thúc nhóm ${tour.code}? Mọi thành viên sẽ rời nhóm và nhận thông báo.`) && end.mutate()}
      >
        Kết thúc nhóm
      </Button>
      {end.isError && <ErrorBox error={end.error} />}
    </div>
  );
}
