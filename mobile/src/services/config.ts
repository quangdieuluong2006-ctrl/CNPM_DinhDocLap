import Constants from "expo-constants";

// Địa chỉ API: ưu tiên EXPO_PUBLIC_API_URL; nếu không có, khi chạy bằng Expo Go trong mạng Wi-Fi
// thì máy tính chạy Metro (hostUri = "192.168.1.22:8081") cũng là máy chạy API ở cổng 3000.
export function defaultApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (host) return `http://${host}:3000`;
  return "http://localhost:3000";
}

// Tâm khuôn viên Dinh Độc Lập (dùng căn bản đồ và kiểm tra "ở xa khuôn viên").
export const PALACE_CENTER = { lat: 10.7770, lng: 106.6953 };
export const FAR_FROM_PALACE_M = 1000;
