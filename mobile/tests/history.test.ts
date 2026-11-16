import { describe, expect, it } from "vitest";
import { dayLabel, groupByDay, localParts, mergeHistory, type LocalVisit, type ServerVisit } from "../src/core/history";

const server = (id: number, placeId: number, startedAt: string, extra: Partial<ServerVisit> = {}): ServerVisit => ({
  id, placeId, placeCode: String(placeId).padStart(3, "0"), title: `Điểm ${placeId}`, lang: "vi",
  trigger: "gps", listenedSec: 60, completed: true, startedAt, ...extra,
});
const local = (clientId: string, placeId: number, startedAt: string, extra: Partial<LocalVisit> = {}): LocalVisit => ({
  clientId, placeId, lang: "vi", trigger: "qr", listenedSec: 30, completed: false, startedAt, ...extra,
});
const lookup = (id: number) => ({ code: String(id).padStart(3, "0"), title: `Bài ${id}` });

describe("lịch sử tham quan (FE-10)", () => {
  it("mới nhất đứng đầu; lượt chưa gửi hiện ngay và được đánh dấu chờ gửi (AC1)", () => {
    const list = mergeHistory(
      [server(1, 1, "2026-11-16T02:00:00Z")],
      [local("a", 2, "2026-11-16T03:00:00.400Z")],
      new Set(["a"]),
      lookup,
    );
    expect(list.map((e) => e.placeId)).toEqual([2, 1]);
    expect(list[0]).toMatchObject({ code: "002", title: "Bài 2", trigger: "qr", pending: true });
    expect(list[1]!.pending).toBe(false);
  });

  it("lượt đã gửi có trên máy chủ thì không hiện hai lần (lệch dưới 1,5 giây do máy chủ làm tròn giây)", () => {
    const list = mergeHistory(
      [server(7, 3, "2026-11-16T03:00:01Z")],
      [local("b", 3, "2026-11-16T03:00:00.600Z")],
      new Set(),
      lookup,
    );
    expect(list).toHaveLength(1);
    expect(list[0]!.key).toBe("s7");
  });

  it("cùng điểm nhưng hai lần nghe khác nhau vẫn giữ cả hai", () => {
    const list = mergeHistory([server(1, 3, "2026-11-16T03:00:00Z")], [local("c", 3, "2026-11-16T03:10:00Z")], new Set(), lookup);
    expect(list).toHaveLength(2);
  });

  it("ngoại tuyến (không có dữ liệu máy chủ) → chỉ hiện lượt trên máy", () => {
    const list = mergeHistory(null, [local("d", 5, "2026-11-16T01:00:00Z")], new Set(["d"]), lookup);
    expect(list).toHaveLength(1);
    expect(list[0]!.pending).toBe(true);
  });

  it("chia theo ngày giờ Việt Nam (UTC+7): 17:30 UTC đã là ngày hôm sau", () => {
    expect(localParts("2026-11-16T17:30:00Z")).toEqual({ day: "2026-11-17", time: "00:30" });
    const groups = groupByDay(
      mergeHistory([server(1, 1, "2026-11-16T17:30:00Z"), server(2, 2, "2026-11-16T16:59:00Z"), server(3, 3, "2026-11-16T01:00:00Z")], [], new Set()),
    );
    expect(groups.map((g) => [g.day, g.data.length])).toEqual([["2026-11-17", 1], ["2026-11-16", 2]]);
  });

  it("nhãn ngày: hôm nay, hôm qua, còn lại dd/mm/yyyy", () => {
    const now = Date.parse("2026-11-16T05:00:00Z"); // 12:00 ngày 16/11 giờ Việt Nam
    const labels = { today: "Hôm nay", yesterday: "Hôm qua" };
    expect(dayLabel("2026-11-16", now, labels)).toBe("Hôm nay");
    expect(dayLabel("2026-11-15", now, labels)).toBe("Hôm qua");
    expect(dayLabel("2026-11-02", now, labels)).toBe("02/11/2026");
  });
});
