import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Badge, Button, ErrorBox, inputCls, Modal, PageHeader } from "../components/ui";
import { apiGet, apiRequest } from "../lib/api";
import type { AdminLanguage, CatalogLanguage } from "../lib/types";

// FE-22 Quản lý ngôn ngữ: thêm từ danh mục ISO 639-1 có tìm kiếm; bật/tắt; mức độ hoàn thiện.
export function LanguagesPage() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const languages = useQuery({ queryKey: ["languages"], queryFn: () => apiGet<{ items: AdminLanguage[] }>("/admin/languages") });
  const toggle = useMutation({
    mutationFn: (l: AdminLanguage) => apiRequest<AdminLanguage>(`/admin/languages/${l.code}`, { method: "PUT", body: { isEnabled: !l.isEnabled } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["languages"] }),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ngôn ngữ thuyết minh"
        subtitle="Khách chỉ thấy ngôn ngữ đang bật và có ít nhất một bài đã duyệt hoặc chờ duyệt. Tiếng Việt và tiếng Anh là ngôn ngữ dự phòng, không tắt được."
        actions={<Button variant="primary" onClick={() => setAdding(true)}>+ Thêm ngôn ngữ</Button>}
      />
      {languages.isError && <ErrorBox error={languages.error} onRetry={() => void languages.refetch()} />}
      {toggle.isError && <ErrorBox error={toggle.error} />}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Mã</th>
              <th className="px-4 py-3 font-medium">Tên</th>
              <th className="px-4 py-3 font-medium">Giọng đọc (TTS)</th>
              <th className="w-1/3 px-4 py-3 font-medium">Mức hoàn thiện (bài đã duyệt / điểm đang xuất bản)</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {languages.data?.items.map((l) => (
              <tr key={l.code}>
                <td className="px-4 py-3 font-mono">{l.code}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{l.nameNative}</p>
                  <p className="text-xs text-slate-500">{l.nameVi} · {l.nameEn}</p>
                </td>
                <td className="px-4 py-3 font-mono text-slate-600">{l.ttsLocale}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${l.completeness}%` }} />
                    </div>
                    <span className="w-24 text-right tabular-nums text-slate-600">
                      {l.approved}/{l.publishedPlaces}
                    </span>
                  </div>
                  {l.pending > 0 && <p className="mt-1 text-xs text-sky-700">{l.pending} bài chờ duyệt</p>}
                </td>
                <td className="px-4 py-3">
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={l.isEnabled}
                      disabled={l.code === "vi" || l.code === "en" || toggle.isPending}
                      onChange={() => toggle.mutate(l)}
                    />
                    {l.isEnabled ? <Badge tone="green">Đang bật</Badge> : <Badge>Đã tắt</Badge>}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding && <AddLanguageDialog onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddLanguageDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const catalog = useQuery({
    queryKey: ["languages", "catalog", search],
    queryFn: () => apiGet<{ items: CatalogLanguage[] }>(`/admin/languages/catalog?q=${encodeURIComponent(search)}`),
  });
  const add = useMutation({
    mutationFn: (code: string) => apiRequest<AdminLanguage>(`/admin/languages/${code}`, { method: "PUT", body: {} }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["languages"] }),
  });

  return (
    <Modal title="Thêm ngôn ngữ từ danh mục ISO 639-1" onClose={onClose}>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Gõ: italia, italiano, ý, it…" className={inputCls} />
      <p className="mt-1 text-xs text-slate-500">Tìm theo tên tiếng Việt (không dấu cũng được), tên tiếng Anh, tên bản ngữ hoặc mã.</p>
      {add.isError && <div className="mt-3"><ErrorBox error={add.error} /></div>}
      <ul className="mt-3 max-h-96 divide-y overflow-y-auto text-sm">
        {catalog.data?.items.map((l) => (
          <li key={l.code} className="flex items-center justify-between gap-3 py-2">
            <span>
              <span className="font-medium text-slate-900">{l.nameNative}</span>{" "}
              <span className="text-slate-500">· {l.nameVi} · {l.code}</span>
            </span>
            {l.added ? (
              <Badge tone="green">Đã có</Badge>
            ) : (
              <Button disabled={add.isPending} onClick={() => add.mutate(l.code)}>Thêm</Button>
            )}
          </li>
        ))}
        {catalog.data?.items.length === 0 && <li className="py-3 text-slate-500">Không tìm thấy ngôn ngữ</li>}
      </ul>
    </Modal>
  );
}
