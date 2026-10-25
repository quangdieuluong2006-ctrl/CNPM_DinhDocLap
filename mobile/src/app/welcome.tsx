import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/ui";
import { useT } from "../hooks";
import { store, useApp } from "../state/store";
import { useColors } from "../theme";

// FE-01 bước 1: lần đầu mở – "Bắt đầu tham quan" (dùng ngay, không tài khoản) hoặc "Đăng nhập / Đăng ký".
export default function Welcome() {
  const c = useColors();
  const t = useT();
  const { settings } = useApp();
  const next = () => router.replace(settings.narrationLang ? "/map" : "/language");

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.primary }]}>
      <View style={styles.top}>
        <View style={[styles.logo, { backgroundColor: c.accent }]}>
          <Text style={styles.logoText}>ĐĐL</Text>
        </View>
        <Text style={styles.title}>{t("welcomeTitle")}</Text>
        <Text style={styles.text}>{t("welcomeText")}</Text>
      </View>
      <View style={styles.actions}>
        <Button
          title={t("startGuest")}
          style={{ backgroundColor: "#fff", borderColor: "#fff" }}
          textColor={c.primary}
          onPress={() => {
            void store.updateSettings({ welcomed: true });
            next();
          }}
        />
        <Text style={styles.hint}>{t("guestHint")}</Text>
        <Button
          title={t("loginOrRegister")}
          variant="ghost"
          style={{ borderColor: "#ffffffaa" }}
          textColor="#fff"
          onPress={() => {
            void store.updateSettings({ welcomed: true });
            router.push({ pathname: "/login", params: { next: "/" } });
          }}
        />
        <Text style={styles.hint}>{t("accountHint")}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "space-between", padding: 24 },
  top: { marginTop: 48, gap: 16 },
  logo: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  logoText: { color: "#fff", fontWeight: "800", fontSize: 22 },
  title: { color: "#fff", fontSize: 30, fontWeight: "800", lineHeight: 36 },
  text: { color: "#ffffffd9", fontSize: 16, lineHeight: 24 },
  actions: { gap: 8, marginBottom: 12 },
  hint: { color: "#ffffffb3", textAlign: "center", fontSize: 13, marginBottom: 10 },
});
