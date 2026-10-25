import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/ui";
import { useT } from "../../hooks";
import { useApp } from "../../state/store";
import { useColors } from "../../theme";

// FE-10 Nhóm tham quan: cần đăng nhập (FE-01) – làm ở bước tiếp theo theo kế hoạch PRD mục 18.1.
export default function TourScreen() {
  const c = useColors();
  const t = useT();
  const { authStatus } = useApp();
  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <Ionicons name="people-outline" size={56} color={c.muted} />
      {authStatus === "authenticated" ? (
        <Text style={{ color: c.muted, textAlign: "center", fontSize: 15 }}>{t("tourComing")}</Text>
      ) : (
        <>
          <Text style={{ color: c.muted, textAlign: "center", fontSize: 15 }}>{t("tourNeedLogin")}</Text>
          <Button title={t("login")} onPress={() => router.push("/login")} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
});
