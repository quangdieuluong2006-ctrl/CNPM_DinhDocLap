// Kiểu dữ liệu trả về từ API (xem Swagger /api/docs).
export type ClientType = "web" | "mobile" | "admin";
export type Role = "user" | "guide" | "admin";
export type Zone = "outdoor" | "ground" | "floor1" | "floor2" | "rooftop" | "basement";
export type PlaceStatus = "draft" | "published" | "hidden";
export type ContentStatus = "draft" | "pending" | "approved";

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PresenceUser {
  userId: number;
  fullName: string;
  email: string;
  role: Role;
  clientTypes: ClientType[];
  openSessions: number;
  onlineSince: string;
  lastSeenAt: string;
}

export interface PresenceResponse {
  count: number;
  activeUsers: number;
  activeUsersAll: number;
  users: PresenceUser[];
  ts: string;
}

export interface StatsResponse {
  totalUsers: number;
  activeUsers: number;
  visitsToday: number;
  activeTours: number;
  publishedPlaces: number;
  pendingContents: number;
  visitsByDay: { day: string; visits: number }[];
  topPlaces: { code: string; title: string; visits: number }[];
  languages: { code: string; name: string; visits: number }[];
}

export interface PresenceUpdate {
  activeUsers: number;
  activeUsersAll: number;
  changed: { userId: number; type: "online" | "offline" } | null;
  ts: string;
}

export interface AdminPlace {
  id: number;
  code: string;
  slug: string;
  internalName: string;
  trigger: "gps" | "indoor";
  zone: Zone;
  lat: number;
  lng: number;
  radiusM: number;
  priority: number;
  sortOrder: number;
  imageUrl: string | null;
  status: PlaceStatus;
  visits: number;
  contents: { approved: number; pending: number; draft: number; withAudio: number };
  createdAt: string;
  updatedAt: string | null;
}

export type PlaceInput = Pick<AdminPlace, "code" | "slug" | "internalName" | "trigger" | "zone" | "lat" | "lng" | "radiusM" | "priority" | "sortOrder" | "status">;

export interface OverlapWarning {
  code: string;
  distanceM: number;
  overlapM: number;
}

export interface PlaceSaved {
  place: AdminPlace;
  warnings: OverlapWarning[];
  version: number;
}

export interface AdminContent {
  lang: string;
  title: string;
  summary: string;
  body: string;
  status: ContentStatus;
  source: "human" | "machine";
  audioUrl: string | null;
  audioDurationSec: number | null;
  audioBytes: number | null;
  updatedBy: { id: number; fullName: string } | null;
  updatedAt: string;
}

export interface AdminLanguage {
  code: string;
  nameVi: string;
  nameEn: string;
  nameNative: string;
  ttsLocale: string;
  isEnabled: boolean;
  sortOrder: number;
  publishedPlaces: number;
  approved: number;
  pending: number;
  draft: number;
  completeness: number;
}

export interface CatalogLanguage {
  code: string;
  nameVi: string;
  nameEn: string;
  nameNative: string;
  ttsLocale: string;
  added: boolean;
}

export interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  status: "active" | "locked";
  lockedReason: string | null;
  uiLocale: string;
  narrationLang: string | null;
  createdAt: string;
  online: boolean;
  clientTypes: ClientType[];
  lastSeenAt: string | null;
  tour: { id: number; code: string; name: string } | null;
  visits: number;
}

export interface UserSession {
  id: number;
  clientType: ClientType;
  ip: string | null;
  userAgent: string | null;
  connectedAt: string;
  lastSeenAt: string;
  disconnectedAt: string | null;
}

export interface Tour {
  id: number;
  code: string;
  name: string;
  guide: { id: number; fullName: string };
  status: "active" | "ended";
  maxMembers: number;
  memberCount: number;
  createdAt: string;
  endedAt: string | null;
}

export interface ActivityLog {
  id: number;
  user: { id: number; fullName: string; email: string } | null;
  action: string;
  entityType: string | null;
  entityId: number | null;
  ip: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}
