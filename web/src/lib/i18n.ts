import { de } from "./locales/de";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { ja } from "./locales/ja";
import { ko } from "./locales/ko";
import { ru } from "./locales/ru";
import { th } from "./locales/th";
import { zh } from "./locales/zh";

// Ngôn ngữ giao diện của Web User: đủ 10 ngôn ngữ thuyết minh. Giao diện đi theo ngôn ngữ thuyết minh khách đã chọn,
// để khách không biết tiếng Anh vẫn hiểu các nút bấm. Tiếng Việt / tiếng Anh ở đây, 8 ngôn ngữ còn lại trong ./locales.
const vi = {
  brand: "Thuyết minh Dinh Độc Lập",
  navHome: "Trang chủ",
  navPlaces: "Các điểm",
  navMap: "Bản đồ",
  heroTitle: "Nghe câu chuyện của Dinh Độc Lập bằng ngôn ngữ của bạn",
  heroText: "Chọn ngôn ngữ, chọn một điểm tham quan và bấm nghe. Trong tòa nhà, quét mã QR đặt tại cửa mỗi phòng để mở đúng bài thuyết minh.",
  narration: "Ngôn ngữ thuyết minh",
  chooseLanguage: "Chọn ngôn ngữ thuyết minh",
  searchLanguage: "Tìm: nhật, japanese, 日本, ja…",
  noLanguage: "Chưa có thuyết minh cho ngôn ngữ này",
  reviewing: "Bản dịch đang được kiểm duyệt",
  places: "điểm",
  allPlaces: "Tất cả các điểm",
  searchPlace: "Tìm theo tên hoặc số điểm…",
  allZones: "Mọi khu vực",
  noResult: "Không có điểm phù hợp",
  listen: "Nghe thuyết minh",
  pause: "Tạm dừng",
  resume: "Nghe tiếp",
  replay: "Nghe lại từ đầu",
  speed: "Tốc độ",
  tts: "Giọng đọc tổng hợp",
  noVoice: "Trình duyệt chưa có giọng đọc cho ngôn ngữ này – bạn có thể đọc nội dung bên dưới.",
  audioError: "Không phát được tệp âm thanh – bạn có thể đọc nội dung bên dưới.",
  showingIn: "Đang hiển thị bằng",
  noTranslation: "chưa có bản dịch",
  autoTrigger: "Ứng dụng tự phát khi bạn đến gần",
  indoorTrigger: "Quét mã QR tại cửa phòng",
  notFound: "Không tìm thấy điểm",
  backToList: "Về danh sách điểm",
  getApp: "Cài ứng dụng để tự động nghe thuyết minh khi bạn đến từng điểm ngoài trời.",
  statPlaces: "điểm tham quan",
  statLangs: "ngôn ngữ",
  howTitle: "Nghe thuyết minh trong 3 bước",
  step1Title: "Chọn ngôn ngữ",
  step1Text: "Bấm nút Thuyết minh để chọn ngôn ngữ bạn muốn nghe; có thể đổi bất cứ lúc nào.",
  step2Title: "Chọn điểm hoặc quét QR",
  step2Text: "Chọn một điểm trong danh sách, hoặc quét mã QR ở cửa phòng để mở đúng bài.",
  step3Title: "Bấm nghe",
  step3Text: "Nghe, tua, đổi tốc độ. Các điểm đã nghe được lưu tự động, không cần đăng ký.",
  nowPlaying: "Đang phát",
  photoBy: "Ảnh",
  photoCollected: "Sưu tầm",
  listens: "lượt nghe",
  historyHint: "Tự lưu trên trình duyệt này – không cần tài khoản.",
  loading: "Đang tải…",
  error: "Không tải được dữ liệu",
  retry: "Thử lại",
  close: "Đóng",
  outdoor: "Ngoài trời",
  ground: "Tầng trệt",
  floor1: "Lầu 1",
  floor2: "Lầu 2–3",
  rooftop: "Sân thượng",
  basement: "Tầng hầm",
  myLocation: "Vị trí của tôi",
  mapHint: "Vòng tròn là vùng ứng dụng tự phát thuyết minh khi bạn đến gần. Biểu tượng 🏛 là các phòng trong tòa nhà – bấm để xem danh sách.",
  geoDenied: "Trình duyệt chưa cho phép xem vị trí – bạn vẫn dùng bản đồ bình thường.",
  whereIndoor: "Trong tòa nhà chính",
  history: "Các điểm đã nghe",
  noHistory: "Bạn chưa nghe điểm nào. Chọn một điểm để bắt đầu!",
  listenedFor: "Đã nghe",
  completed: "Nghe hết",
  online: "Đang trực tuyến",
  more: "Xem thêm",
};

export type Dict = typeof vi;
export type TKey = keyof Dict;

const en: Dict = {
  brand: "Independence Palace Audio Guide",
  navHome: "Home",
  navPlaces: "Places",
  navMap: "Map",
  heroTitle: "Hear the story of the Independence Palace in your language",
  heroText: "Pick a language, choose a stop and press play. Inside the building, scan the QR code at each room's door to open its narration.",
  narration: "Narration language",
  chooseLanguage: "Choose narration language",
  searchLanguage: "Search: japanese, 日本, ja…",
  noLanguage: "No narration in this language yet",
  reviewing: "Translation under review",
  places: "places",
  allPlaces: "All places",
  searchPlace: "Search by name or number…",
  allZones: "All areas",
  noResult: "No matching places",
  listen: "Listen",
  pause: "Pause",
  resume: "Resume",
  replay: "Replay from start",
  speed: "Speed",
  tts: "Synthesized voice",
  noVoice: "Your browser has no voice for this language – you can read the text below.",
  audioError: "Could not play the audio – you can read the text below.",
  showingIn: "Shown in",
  noTranslation: "no translation yet",
  autoTrigger: "The app plays automatically when you are nearby",
  indoorTrigger: "Scan the QR code at the room's door",
  notFound: "Place not found",
  backToList: "Back to places",
  getApp: "Install the app to hear narration automatically when you reach each outdoor stop.",
  statPlaces: "stops",
  statLangs: "languages",
  howTitle: "Listen in 3 steps",
  step1Title: "Pick a language",
  step1Text: "Tap the narration button to choose the language you want to hear; change it any time.",
  step2Title: "Choose a stop or scan QR",
  step2Text: "Pick a stop from the list, or scan the QR code at a room's door to open its narration.",
  step3Title: "Press play",
  step3Text: "Listen, skip, change the speed. Places you listened to are saved automatically – no sign-up.",
  nowPlaying: "Now playing",
  photoBy: "Photo",
  photoCollected: "Collected online",
  listens: "listens",
  historyHint: "Saved automatically in this browser – no account needed.",
  loading: "Loading…",
  error: "Could not load data",
  retry: "Retry",
  close: "Close",
  outdoor: "Outdoors",
  ground: "Ground floor",
  floor1: "First floor",
  floor2: "Second–third floor",
  rooftop: "Rooftop",
  basement: "Basement",
  myLocation: "My location",
  mapHint: "Circles are the areas where the app plays narration automatically. The 🏛 marker groups the rooms inside the building – tap it to see the list.",
  geoDenied: "Location permission was not granted – you can still use the map.",
  whereIndoor: "Inside the main building",
  history: "Places you listened to",
  noHistory: "You have not listened to any place yet. Pick one to start!",
  listenedFor: "Listened",
  completed: "Completed",
  online: "Online",
  more: "Load more",
};

export const UI_LOCALES = ["vi", "en", "zh", "ko", "ja", "fr", "de", "ru", "es", "th"] as const;
export type UiLocale = (typeof UI_LOCALES)[number];
export const DICTS: Record<UiLocale, Dict> = { vi, en, zh, ko, ja, fr, de, ru, es, th };

// Ngôn ngữ thuyết minh chưa có bản dịch giao diện (quản trị viên thêm ngôn ngữ mới) → giao diện tiếng Anh
export function uiLocaleFor(lang: string): UiLocale {
  return (UI_LOCALES as readonly string[]).includes(lang) ? (lang as UiLocale) : "en";
}

export function translator(locale: UiLocale) {
  const dict = DICTS[locale];
  return (key: TKey) => dict[key] || en[key];
}

// Bỏ dấu, chữ thường – để gõ "nhat" vẫn khớp "Tiếng Nhật", "trinh quoc thu" khớp "Trình Quốc thư".
export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

export function matchLanguage(l: { code: string; nameVi: string; nameEn: string; nameNative: string }, q: string): boolean {
  const needle = fold(q.trim());
  if (!needle) return true;
  return l.code === needle || [l.nameVi, l.nameEn, l.nameNative].some((n) => fold(n).includes(needle));
}

export const ZONES = ["outdoor", "ground", "floor1", "floor2", "rooftop", "basement"] as const;
