import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Badge, Button, ErrorBox, Field, inputCls } from "../components/ui";
import { ApiError, apiGet, apiRequest, mediaUrl } from "../lib/api";
import { bytes, CONTENT_STATUS_LABEL, dateTime, duration } from "../lib/format";
import { measureAudioDuration } from "../lib/slug";
import type { AdminContent, AdminLanguage, AdminPlace, ContentStatus } from "../lib/types";

const STATUS_TONE = { approved: "green", pending: "blue", draft: "amber" } as const;
const EMPTY = { title: "", summary: "", body: "", status: "draft" as ContentStatus, source: "human" as "human" | "machine" };

// FE-21 Nội dung đa ngôn ngữ và âm thanh: mỗi ngôn ngữ một bài; Nháp → Chờ duyệt → Đã duyệt.
// Bài chờ duyệt vẫn hiện cho khách kèm nhãn; bài nháp không hiện. Không có tệp âm thanh → ứng dụng dùng giọng tổng hợp.
export function ContentEditor({ place, contents }: { place: AdminPlace; contents: AdminContent[] }) {
  const qc = useQueryClient();
  const languages = useQuery({ queryKey: ["languages"], queryFn: () => apiGet<{ items: AdminLanguage[] }>("/admin/languages") });
  const [lang, setLang] = useState("vi");
  const current = contents.find((c) => c.lang === lang);
  const [form, setForm] = useState(EMPTY);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setForm(current ? { title: current.title, summary: current.summary, body: current.body, status: current.status, source: current.source } : EMPTY);
    setMessage(null);
  }, [lang, current]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["places"] });
    void qc.invalidateQueries({ queryKey: ["languages"] });
  };
  const save = useMutation({
    mutationFn: (body: typeof EMPTY) => apiRequest<{ version: number }>(`/admin/places/${place.id}/contents/${lang}`, { method: "PUT", body }),
    onSuccess: (r) => {
      setMessage(`Đã lưu – phiên bản nội dung v${r.version}`);
      refresh();
    },
  });
  const removeContent = useMutation({
    mutationFn: () => apiRequest<void>(`/admin/places/${place.id}/contents/${lang}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.set("file", file);
      const sec = await measureAudioDuration(file);
      if (sec) fd.set("durationSec", String(sec));
      return apiRequest<{ version: number }>(`/admin/places/${place.id}/contents/${lang}/audio`, { method: "POST", body: fd });
    },
    onSuccess: refresh,
  });
  const removeAudio = useMutation({
    mutationFn: () => apiRequest<void>(`/admin/places/${place.id}/contents/${lang}/audio`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  const langs = (languages.data?.items ?? []).filter((l) => l.isEnabled || contents.some((c) => c.lang === l.code));
  const byLang = new Map(contents.map((c) => [c.lang, c]));
  const audio = mediaUrl(current?.audioUrl);
  const uploadError = upload.error instanceof ApiError ? upload.error.message : upload.error?.message;

  return (
    <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Bài thuyết minh theo ngôn ngữ</h2>
        <Link to="/languages" className="text-sm text-emerald-700 hover:underline">
          + Thêm ngôn ngữ khác
        </Link>
      </div>
      {languages.isError && <ErrorBox error={languages.error} />}
      <div className="flex flex-wrap gap-2">
        {langs.map((l) => {
          const c = byLang.get(l.code);
          return (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${lang === l.code ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "hover:bg-slate-50"}`}
            >
              <span className="font-medium">{l.nameNative}</span>{" "}
              {c ? <Badge tone={STATUS_TONE[c.status]}>{CONTENT_STATUS_LABEL[c.status]}</Badge> : <Badge>Chưa có</Badge>}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <form
          className="space-y-4 xl:col-span-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(form);
          }}
        >
          <Field label="Tiêu đề">
            <input required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Tóm tắt" hint={`${form.summary.length}/300 – hiện trong danh sách điểm`}>
            <input required maxLength={300} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Nội dung thuyết minh" hint={`${form.body.length}/5000 ký tự – khoảng ${Math.round(form.body.length / 14)} giây khi đọc bằng giọng tổng hợp`}>
            <textarea required rows={10} maxLength={5000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className={`${inputCls} leading-relaxed`} />
          </Field>
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Trạng thái">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ContentStatus })} className="rounded-md border px-2 py-2 text-sm">
                <option value="draft">Nháp – khách không thấy</option>
                <option value="pending">Chờ duyệt – khách thấy kèm nhãn</option>
                <option value="approved">Đã duyệt</option>
              </select>
            </Field>
            <Field label="Nguồn">
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as "human" | "machine" })} className="rounded-md border px-2 py-2 text-sm">
                <option value="human">Người viết/dịch</option>
                <option value="machine">Dịch máy</option>
              </select>
            </Field>
            <Button type="submit" variant="primary" disabled={save.isPending}>
              {save.isPending ? "Đang lưu…" : "Lưu bài"}
            </Button>
            {current?.status === "pending" && (
              <Button variant="secondary" disabled={save.isPending} onClick={() => save.mutate({ ...form, status: "approved" })}>
                ✓ Duyệt bản dịch
              </Button>
            )}
            {current && lang !== "vi" && (
              <Button variant="danger" disabled={removeContent.isPending} onClick={() => window.confirm("Xóa bài ngôn ngữ này?") && removeContent.mutate()}>
                Xóa bài
              </Button>
            )}
          </div>
          {save.isError && <ErrorBox error={save.error} />}
          {message && <p className="text-sm text-emerald-700">{message}</p>}
          {current?.updatedBy && (
            <p className="text-xs text-slate-500">
              Sửa lần cuối bởi {current.updatedBy.fullName} lúc {dateTime(current.updatedAt)}
            </p>
          )}
        </form>

        <div className="space-y-3 rounded-lg bg-slate-50 p-4 text-sm">
          <h3 className="font-medium text-slate-800">Tệp âm thanh</h3>
          {!current ? (
            <p className="text-slate-500">Lưu bài trước, sau đó tải tệp âm thanh.</p>
          ) : audio ? (
            <>
              <audio controls src={audio} className="w-full" />
              <p className="text-slate-600">
                Thời lượng {duration(current.audioDurationSec)} · {bytes(current.audioBytes)}
              </p>
              <Button variant="danger" disabled={removeAudio.isPending} onClick={() => removeAudio.mutate()}>
                Xóa tệp (dùng giọng tổng hợp)
              </Button>
            </>
          ) : (
            <p className="text-slate-500">Chưa có tệp – ứng dụng đọc nội dung bằng giọng tổng hợp của điện thoại.</p>
          )}
          {current && (
            <label className="block">
              <span className="text-slate-700">{audio ? "Thay tệp khác" : "Tải tệp lên"}</span>{" "}
              <span className="text-xs text-slate-500">(mp3, m4a, aac, ogg, wav ≤ 20 MB)</span>
              <input
                type="file"
                accept="audio/*"
                className="mt-1 block w-full text-sm"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload.mutate(f);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          {upload.isPending && <Badge tone="blue">Đang tải lên…</Badge>}
          {uploadError && <p className="text-red-600">{uploadError}</p>}
        </div>
      </div>
    </section>
  );
}
