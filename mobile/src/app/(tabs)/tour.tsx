import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useT } from "../../hooks";
import { useColors } from "../../theme";

// FE-10 Nhóm tham quan: cần đăng nhập (FE-01) – làm ở bước tiếp theo theo kế hoạch PRD mục 18.1.
export default function TourScreen() {
  const c = useColors();
  const t = useT();
  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <Ionicons name="people-outline" size={56} color={c.muted} />
      <Text style={{ color: c.muted, textAlign: "center", fontSize: 15 }}>{t("tourComing")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
});
