import type { Trigger } from "./narration";

// FE-10 Lịch sử tham quan (PRD v2.2, mục 5): ghép lượt nghe trên máy chủ (GET /me/visits) với lượt nghe ghi trên máy,
// bỏ trùng, sắp mới nhất trước và chia theo ngày giờ Việt Nam. Thuần TypeScript nên kiểm thử được bằng Vitest.

// Một dòng của GET /me/visits
export interface ServerVisit {
  id: number;
  placeId: number;
  placeCode: string;
  title: string;
  lang: string;
  trigger: Trigger;
  listenedSec: number;
  completed: boolean;
  startedAt: string;
}

// Lượt nghe ghi trên máy (services/visits.ts), kể cả lượt đã gửi lên máy chủ
export interface LocalVisit {
  clientId: string;
  placeId: number;
  lang: string;
  trigger: Trigger;
  listenedSec: number;
  completed: boolean;
  startedAt: string;
}

export interface HistoryEntry {
  key: string;
  placeId: number;
  code: string | null;
  title: string | null;
  lang: string;
  trigger: Trigger;
  listenedSec: number;
  completed: boolean;
  startedAt: string;
  pending: boolean; // còn nằm trong hàng đợi, chưa gửi lên máy chủ
}

// Cột started_at là DATETIME2(0): máy chủ làm tròn tới giây, nên cùng một lượt nghe có thể lệch dưới 1 giây so với máy.
export const SAME_VISIT_MS = 1500;
// Giờ Việt Nam = UTC+7, không đổi giờ theo mùa.
export const VN_OFFSET_MIN = 7 * 60;

export function mergeHistory(
  server: ServerVisit[] | null,
  local: LocalVisit[],
  pendingIds: ReadonlySet<string>,
  lookup: (placeId: number) => { code: string; title: string | null } | undefined = () => undefined,
): HistoryEntry[] {
  const out: HistoryEntry[] = (server ?? []).map((v) => ({
    key: `s${v.id}`,
    placeId: v.placeId,
    code: v.placeCode,
    title: v.title,
    lang: v.lang,
    trigger: v.trigger,
    listenedSec: v.listenedSec,
    completed: v.completed,
    startedAt: v.startedAt,
    pending: false,
  }));
  for (const v of local) {
    const t = Date.parse(v.startedAt);
    // Đã có trên máy chủ (cùng điểm, cùng thời điểm) → bỏ bản trên máy, dùng bản của máy chủ
    const onServer = (server ?? []).some((s) => s.placeId === v.placeId && Math.abs(Date.parse(s.startedAt) - t) <= SAME_VISIT_MS);
    if (onServer) continue;
    const place = lookup(v.placeId);
    out.push({
      key: `l${v.clientId}`,
      placeId: v.placeId,
      code: place?.code ?? null,
      title: place?.title ?? null,
      lang: v.lang,
      trigger: v.trigger,
      listenedSec: v.listenedSec,
      completed: v.completed,
      startedAt: v.startedAt,
      pending: pendingIds.has(v.clientId),
    });
  }
  return out.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

// "2026-11-16T17:30:00Z" → ngày "2026-11-17" và giờ "00:30" theo giờ Việt Nam
export function localParts(iso: string, offsetMin = VN_OFFSET_MIN): { day: string; time: string } {
  const d = new Date(Date.parse(iso) + offsetMin * 60_000);
  const day = d.toISOString().slice(0, 10);
  const time = d.toISOString().slice(11, 16);
  return { day, time };
}

// Chia danh sách (đã sắp mới nhất trước) thành các nhóm theo ngày, giữ nguyên thứ tự
export function groupByDay(entries: HistoryEntry[], offsetMin = VN_OFFSET_MIN): { day: string; data: HistoryEntry[] }[] {
  const groups: { day: string; data: HistoryEntry[] }[] = [];
  for (const e of entries) {
    const { day } = localParts(e.startedAt, offsetMin);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.data.push(e);
    else groups.push({ day, data: [e] });
  }
  return groups;
}

// Nhãn ngày: hôm nay / hôm qua / dd/mm/yyyy
export function dayLabel(day: string, now: number, labels: { today: string; yesterday: string }, offsetMin = VN_OFFSET_MIN): string {
  const today = localParts(new Date(now).toISOString(), offsetMin).day;
  const yesterday = localParts(new Date(now - 86_400_000).toISOString(), offsetMin).day;
  if (day === today) return labels.today;
  if (day === yesterday) return labels.yesterday;
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}
