import { randomUUID } from "expo-crypto";
import type { VisitRecord } from "../core/narration";
import type { Api, VisitPayload } from "./api";
import { getJson, setJson } from "./storage";

// Lượt ghé được xếp hàng trong AsyncStorage và gửi theo lô (POST /visits/batch). Mỗi lượt có clientId UUID
// do máy sinh nên gửi lại sau khi mất mạng không bị trùng (PRD v1.0, mục 4.6.4).
const KEY = "visits.queue";
const MAX_QUEUE = 500;
let flushing = false;

export async function enqueueVisit(v: VisitRecord): Promise<void> {
  const queue = await getJson<VisitPayload[]>(KEY, []);
  queue.push({ ...v, clientId: randomUUID() });
  await setJson(KEY, queue.slice(-MAX_QUEUE));
}

export async function pendingVisits(): Promise<number> {
  return (await getJson<VisitPayload[]>(KEY, [])).length;
}

// Gửi tối đa 200 lượt/lần. Lỗi mạng → giữ nguyên để gửi lần sau.
export async function flushVisits(api: Api): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  try {
    let sent = 0;
    for (;;) {
      const queue = await getJson<VisitPayload[]>(KEY, []);
      const batch = queue.slice(0, 200);
      if (batch.length === 0) return sent;
      await api.sendVisits(batch);
      // Máy chủ đã nhận (kể cả trùng hoặc bị từ chối vì dữ liệu sai) → bỏ khỏi hàng đợi.
      const latest = await getJson<VisitPayload[]>(KEY, []);
      const done = new Set(batch.map((b) => b.clientId));
      await setJson(KEY, latest.filter((v) => !done.has(v.clientId)));
      sent += batch.length;
    }
  } catch {
    return 0;
  } finally {
    flushing = false;
  }
}
