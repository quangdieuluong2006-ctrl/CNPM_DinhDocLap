import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Rung nhẹ khi khách vào vùng một điểm (FE-05, FE-12). Trình duyệt không hỗ trợ rung → bỏ qua; lỗi rung không làm hỏng việc phát.
export function arrivalBuzz(): void {
  if (Platform.OS === "web") return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
