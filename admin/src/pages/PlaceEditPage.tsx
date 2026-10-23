import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { PlacesMap, PALACE_CENTER } from "../components/PlacesMap";
import { Badge, Button, ErrorBox, Field, inputCls, PageHeader } from "../components/ui";
import { ApiError, apiGet, apiRequest, mediaUrl } from "../lib/api";
import { ZONE_LABEL } from "../lib/format";
import { slugify } from "../lib/slug";
import type { AdminContent, AdminPlace, OverlapWarning, PlaceInput, PlaceSaved } from "../lib/types";
import { ContentEditor } from "./ContentEditor";

const EMPTY: PlaceInput = {
  code: "", slug: "", internalName: "", trigger: "gps", zone: "outdoor",
  lat: PALACE_CENTER[0], lng: PALACE_CENTER[1], radiusM: 25, priority: 0, sortOrder: 0, status: "draft",
};

function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || err.code !== "VALIDATION_ERROR") return {};
  const issues = (err.details as { fields?: { path: (string | number)[]; message: string }[] } | undefined)?.fields ?? [];
  return Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));
}

// FE-20 Thêm/sửa điểm (bấm bản đồ để đặt tọa độ) + FE-21 bài theo ngôn ngữ, âm thanh, ảnh.
export function PlaceEditPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<PlaceInput>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [warnings, setWarnings] = useState<OverlapWarning[]>([]);
  const [saved, setSaved] = useState<string | null>(null);

  const all = useQuery({ queryKey: ["places"], queryFn: () => apiGet<{ items: AdminPlace[] }>("/admin/places") });
  const detail = useQuery({
    queryKey: ["places", "detail", id],
    queryFn: () => apiGet<{ place: AdminPlace; contents: AdminContent[] }>(`/admin/places/${id}`),
    enabled: !isNew,
  });

  useEffect(() => {
    const p = detail.data?.place;
    if (p) {
      setForm({ code: p.code, slug: p.slug, internalName: p.internalName, trigger: p.trigger, zone: p.zone, lat: p.lat, lng: p.lng,
        radiusM: p.radiusM, priority: p.priority, sortOrder: p.sortOrder, status: p.status });
      setSlugTouched(true);
    }
  }, [detail.data?.place]);

  const save = useMutation({
    mutationFn: () =>
      isNew
        ? apiRequest<PlaceSaved>("/admin/places", { method: "POST", body: form })
        : apiRequest<PlaceSaved>(`/admin/places/${id}`, { method: "PATCH", body: form }),
    onSuccess: (r) => {
      setWarnings(r.warnings);
      setSaved(`Đã lưu – phiên bản nội dung v${r.version}. Ứng dụng sẽ tải bản mới.`);
      void qc.invalidateQueries({ queryKey: ["places"] });
      if (isNew) navigate(`/places/${r.place.id}`, { replace: true });
    },
  });
  const remove = useMutation({
    mutationFn: () => apiRequest<void>(`/admin/places/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["places"] });
      navigate("/places");
    },
  });
  const uploadImage = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.set("file", file);
      return apiRequest<PlaceSaved>(`/admin/places/${id}/image`, { method: "POST", body: fd });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["places"] }),
  });

  const set = <K extends keyof PlaceInput>(k: K, v: PlaceInput[K]) => {
    setSaved(null);
    setForm((f) => ({ ...f, [k]: v, ...(k === "internalName" && !slugTouched ? { slug: slugify(String(v)) } : {}) }));
  };
  const errors = fieldErrors(save.error);
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  if (!isNew && detail.isPending) return <p className="text-slate-500">Đang tải…</p>;
  if (!isNew && detail.isError) return <ErrorBox error={detail.error} />;
  const place = detail.data?.place;
  const others = (all.data?.items ?? []).filter((p) => String(p.id) !== id);
  const image = mediaUrl(place?.imageUrl);

  return (
    <div className="space-y-6">
      <PageHeader
        title={isNew ? "Thêm điểm thuyết minh" : `Điểm ${place?.code} – ${place?.internalName}`}
        subtitle={<Link to="/places" className="text-emerald-700 hover:underline">‹ Danh sách điểm</Link>}
      />

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Số điểm (3 chữ số)" hint="Chữ số đầu là khu vực: 0 ngoài trời, 1 tầng trệt, 2 lầu 1…" error={errors.code}>
              <input required pattern="[0-9]{3}" maxLength={3} value={form.code} onChange={(e) => set("code", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Trạng thái">
              <select value={form.status} onChange={(e) => set("status", e.target.value as PlaceInput["status"])} className={inputCls}>
                <option value="draft">Nháp (khách không thấy)</option>
                <option value="published">Xuất bản</option>
                <option value="hidden">Ẩn</option>
              </select>
            </Field>
          </div>
          <Field label="Tên nội bộ" error={errors.internalName}>
            <input required value={form.internalName} onChange={(e) => set("internalName", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Slug (đường dẫn)" hint="Chữ thường không dấu, số, dấu gạch ngang" error={errors.slug}>
            <input required value={form.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Kiểu kích hoạt">
              <select value={form.trigger} onChange={(e) => set("trigger", e.target.value as PlaceInput["trigger"])} className={inputCls}>
                <option value="gps">Tự động theo GPS (ngoài trời)</option>
                <option value="indoor">Trong nhà – quét QR / nhập số</option>
              </select>
            </Field>
            <Field label="Khu vực">
              <select value={form.zone} onChange={(e) => set("zone", e.target.value as PlaceInput["zone"])} className={inputCls}>
                {Object.entries(ZONE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Vĩ độ" error={errors.lat}>
              <input type="number" step="0.000001" required value={form.lat} onChange={(e) => set("lat", Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Kinh độ" error={errors.lng}>
              <input type="number" step="0.000001" required value={form.lng} onChange={(e) => set("lng", Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Bán kính (m)" hint="15–80 m" error={errors.radiusM}>
              <input type="number" min={15} max={80} value={form.radiusM} onChange={(e) => set("radiusM", Number(e.target.value))} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ưu tiên" hint="Đứng trong nhiều vùng: số lớn hơn được phát trước">
              <input type="number" value={form.priority} onChange={(e) => set("priority", Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Thứ tự trên lộ trình">
              <input type="number" min={0} value={form.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} className={inputCls} />
            </Field>
          </div>

          {save.isError && Object.keys(errors).length === 0 && <ErrorBox error={save.error} />}
          {warnings.length > 0 && (
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              ⚠ Vùng kích hoạt chồng lấn quá 50% với:{" "}
              {warnings.map((w) => `điểm ${w.code} (cách ${w.distanceM} m, chồng ${w.overlapM} m)`).join("; ")}. Khách có thể nghe nhầm điểm – cân nhắc giảm bán kính.
            </div>
          )}
          {saved && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{saved}</p>}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={save.isPending}>
              {save.isPending ? "Đang lưu…" : isNew ? "Thêm điểm" : "Lưu thay đổi"}
            </Button>
            {!isNew && (
              <Button
                variant="danger"
                disabled={remove.isPending}
                onClick={() => window.confirm(`Xóa điểm ${place?.code}? Không thể hoàn tác.`) && remove.mutate()}
              >
                Xóa điểm
              </Button>
            )}
          </div>
          {remove.isError && (
            <p className="text-sm text-red-600">
              {remove.error instanceof ApiError && remove.error.code === "PLACE_HAS_VISITS"
                ? "Điểm đã có lượt nghe nên không xóa được (giữ số liệu thống kê) – hãy chuyển trạng thái sang Ẩn."
                : remove.error.message}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm text-slate-500">Bấm lên bản đồ để đặt tọa độ. Vòng đỏ nét đứt là vùng kích hoạt của điểm đang sửa.</p>
          <PlacesMap
            places={others}
            editing={{ lat: form.lat, lng: form.lng, radiusM: form.radiusM, trigger: form.trigger, code: form.code }}
            onPick={(lat, lng) => { set("lat", lat); set("lng", lng); }}
            height={460}
          />
          {!isNew && (
            <div className="flex items-center gap-4 rounded-xl border bg-white p-4 shadow-sm">
              {image ? <img src={image} alt="" className="h-20 w-28 rounded object-cover" /> : <div className="flex h-20 w-28 items-center justify-center rounded bg-slate-100 text-xs text-slate-400">Chưa có ảnh</div>}
              <label className="text-sm">
                <span className="font-medium text-slate-700">Ảnh điểm</span> <span className="text-slate-500">(jpg, png, webp ≤ 5 MB)</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="mt-1 block text-sm"
                  onChange={(e) => e.target.files?.[0] && uploadImage.mutate(e.target.files[0])}
                />
                {uploadImage.isPending && <Badge tone="blue">Đang tải lên…</Badge>}
                {uploadImage.isError && <span className="text-red-600">{uploadImage.error.message}</span>}
              </label>
            </div>
          )}
        </div>
      </form>

      {!isNew && place && <ContentEditor place={place} contents={detail.data?.contents ?? []} />}
    </div>
  );
}
