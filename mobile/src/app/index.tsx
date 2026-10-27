import { Redirect } from "expo-router";
import { useApp } from "../state/store";

// Lần đầu mở: màn Chào mừng (FE-01) → chọn ngôn ngữ thuyết minh (FE-02) → tab Bản đồ.
export default function Index() {
  const { settings } = useApp();
  if (!settings.welcomed) return <Redirect href="/welcome" />;
  return <Redirect href={settings.narrationLang ? "/map" : "/language"} />;
}
