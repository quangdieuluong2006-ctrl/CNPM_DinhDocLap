import { ApiError } from "../../lib/apiError.js";
import { emitTo, isUserConnected, roomLeaveAll, userJoinRoom, userLeaveRoom } from "../../realtime/hub.js";
import { logActivity } from "../activity/activity.service.js";
import type { Role } from "../auth/tokens.js";
import * as repo from "./tours.repository.js";

export const tourRoom = (tourId: number) => `tour:${tourId}`;

export function toTourDto(t: repo.TourRow) {
  return {
    id: t.id,
    code: t.code,
    name: t.name,
    guide: { id: t.guide_id, fullName: t.guide_name },
    status: t.status,
    maxMembers: t.max_members,
    memberCount: t.member_count,
    createdAt: t.created_at,
    endedAt: t.ended_at,
  };
}

export function toMemberDto(m: repo.MemberRow, guideId: number) {
  return {
    userId: m.user_id,
    fullName: m.full_name,
    isGuide: m.user_id === guideId,
    online: m.online === 1,
    joinedAt: m.joined_at,
    currentPlaceId: m.current_place_id,
    currentPlaceCode: m.current_place_code,
    currentPlaceAt: m.current_place_at,
  };
}

export async function getTourOr404(by: { id: number } | { code: string }): Promise<repo.TourRow> {
  const tour = await repo.findTour(by);
  if (!tour) throw new ApiError(404, "TOUR_NOT_FOUND", "Không tìm thấy nhóm");
  return tour;
}

export async function createTour(guideId: number, name: string, maxMembers: number, ip?: string) {
  const id = await repo.createTour(guideId, name, maxMembers);
  userJoinRoom(guideId, tourRoom(id));
  const tour = await getTourOr404({ id });
  await logActivity({ userId: guideId, action: "tour.create", entityType: "tour", entityId: id, ip, detail: { code: tour.code, name } });
  return toTourDto(tour);
}

export async function joinTour(code: string, userId: number) {
  const tour = await getTourOr404({ code });
  const result = await repo.joinTour(tour.id, userId);
  userJoinRoom(userId, tourRoom(tour.id));
  if (result === "joined") {
    const member = (await repo.listMembers(tour.id)).find((m) => m.user_id === userId);
    if (member) emitTo(tourRoom(tour.id), "tour.member.joined", { tourId: tour.id, member: toMemberDto(member, tour.guide_id) });
  }
  return { result, tour: toTourDto((await repo.findTour({ id: tour.id }))!) };
}

export async function leaveTour(tourId: number, userId: number): Promise<void> {
  if (!(await repo.leaveTour(tourId, userId))) throw new ApiError(404, "TOUR_NOT_FOUND", "Bạn không ở trong nhóm này");
  userLeaveRoom(userId, tourRoom(tourId));
  emitTo(tourRoom(tourId), "tour.member.left", { tourId, userId });
}

// Chỉ hướng dẫn viên của nhóm hoặc admin được kết thúc nhóm.
export async function endTour(tourId: number, actor: { sub: number; role: Role }, ip?: string): Promise<void> {
  const tour = await getTourOr404({ id: tourId });
  if (actor.role !== "admin" && tour.guide_id !== actor.sub) {
    throw new ApiError(403, "FORBIDDEN", "Chỉ hướng dẫn viên của nhóm hoặc quản trị viên được kết thúc nhóm");
  }
  if (tour.status === "ended") throw new ApiError(409, "TOUR_ENDED", "Nhóm đã kết thúc");
  await repo.endTour(tourId);
  emitTo(tourRoom(tourId), "tour.ended", { tourId, endedBy: actor.sub });
  roomLeaveAll(tourRoom(tourId));
  await logActivity({ userId: actor.sub, action: "tour.end", entityType: "tour", entityId: tourId, ip });
}

// Thành viên đang ở nhóm, hướng dẫn viên của nhóm hoặc admin mới xem được danh sách.
export async function membersFor(tourId: number, actor: { sub: number; role: Role }) {
  const tour = await getTourOr404({ id: tourId });
  const members = await repo.listMembers(tourId);
  const allowed = actor.role === "admin" || tour.guide_id === actor.sub || members.some((m) => m.user_id === actor.sub);
  if (!allowed) throw new ApiError(403, "FORBIDDEN", "Bạn không ở trong nhóm này");
  return { tour: toTourDto(tour), members: members.map((m) => toMemberDto(m, tour.guide_id)) };
}

// Sự kiện tour.position từ socket: lưu điểm đang nghe và báo cho cả nhóm.
export async function updatePosition(userId: number, placeId: number): Promise<number | undefined> {
  const tourId = await repo.setCurrentPlace(userId, placeId);
  if (tourId !== undefined) {
    emitTo(tourRoom(tourId), "tour.member.updated", {
      tourId, userId, online: true, currentPlaceId: placeId, at: new Date().toISOString(),
    });
  }
  return tourId;
}

// Gọi khi kết nối hoặc ngắt kết nối socket để cả nhóm thấy trạng thái trực tuyến.
export async function announceOnline(userId: number): Promise<void> {
  const m = await repo.activeMembership(userId);
  if (!m) return;
  emitTo(tourRoom(m.tour_id), "tour.member.updated", {
    tourId: m.tour_id, userId, online: await isUserConnected(userId), at: new Date().toISOString(),
  });
}
