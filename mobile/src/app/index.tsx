import { Redirect } from "expo-router";
import { useApp } from "../state/store";

// Lần đầu mở: chưa chọn ngôn ngữ thuyết minh → màn hình chọn ngôn ngữ (FE-02); sau đó vào tab Bản đồ.
export default function Index() {
  const { settings } = useApp();
  return <Redirect href={settings.narrationLang ? "/map" : "/language"} />;
}
