import { useColorScheme } from "react-native";

// Màu chủ đạo lấy cảm hứng từ Dinh Độc Lập: xanh lục sẫm của mái và vàng đồng của chi tiết trang trí.
const light = {
  bg: "#F6F5F1",
  card: "#FFFFFF",
  text: "#1C2421",
  muted: "#5E6B66",
  border: "#E2E0D8",
  primary: "#1F5C4A",
  primaryText: "#FFFFFF",
  accent: "#B8862F",
  warn: "#C2410C",
  warnBg: "#FFEDD5",
  info: "#0E7490",
  infoBg: "#E0F2FE",
  done: "#15803D",
  marker: "#1F5C4A",
  markerDone: "#9CA3AF",
  markerPlaying: "#B8862F",
};

const dark: typeof light = {
  bg: "#0F1513",
  card: "#18211E",
  text: "#E8EEEB",
  muted: "#9AA8A2",
  border: "#2A3631",
  primary: "#3E9C7F",
  primaryText: "#0B110F",
  accent: "#D9A84E",
  warn: "#FB923C",
  warnBg: "#3B1F0E",
  info: "#38BDF8",
  infoBg: "#0C2733",
  done: "#4ADE80",
  marker: "#3E9C7F",
  markerDone: "#6B7280",
  markerPlaying: "#D9A84E",
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}
