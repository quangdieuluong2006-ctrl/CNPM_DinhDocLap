import { router } from "expo-router";
import { ImageBackground, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, FadeIn } from "../components/ui";
import { useT } from "../hooks";
import { HERO_PHOTO } from "../photos";
import { store, useApp } from "../state/store";
import { useColors } from "../theme";

const SHADE_STEPS = [0.1, 0.12, 0.15, 0.18, 0.22, 0.26];

// Lần đầu mở: một nút "Bắt đầu tham quan" – không đăng nhập / đăng ký (app tự tạo phiên khách ẩn danh).
export default function Welcome() {
  const c = useColors();
  const t = useT();
  const { settings } = useApp();
  const next = () => router.replace(settings.narrationLang ? "/map" : "/language");

  return (
    <ImageBackground source={HERO_PHOTO.source} resizeMode="cover" style={{ flex: 1, backgroundColor: c.primary }}>
    {/* Lớp phủ xanh đậm dần xuống dưới để chữ trắng luôn đọc rõ trên ảnh */}
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0F2F27", opacity: 0.45 }]} />
    {/* Giả lập lớp chuyển màu (không cần thêm thư viện gradient): các dải mờ dần chồng lên nhau ở nửa dưới */}
    {SHADE_STEPS.map((o, i) => (
      <View key={i} style={[styles.shade, { top: `${40 + i * 10}%`, opacity: o }]} />
    ))}
    <SafeAreaView style={styles.root}>
      <FadeIn style={styles.top}>
        <View style={[styles.logo, { backgroundColor: c.accent }]}>
          <Text style={styles.logoText}>ĐĐL</Text>
        </View>
        <Text style={styles.title}>{t("welcomeTitle")}</Text>
        <Text style={styles.text}>{t("welcomeText")}</Text>
      </FadeIn>
      <FadeIn delay={250} style={styles.actions}>
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
      </FadeIn>
    </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "space-between", padding: 24 },
  shade: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#0F2F27" },
  top: { marginTop: 48, gap: 16 },
  logo: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  logoText: { color: "#fff", fontWeight: "800", fontSize: 22 },
  title: { color: "#fff", fontSize: 30, fontWeight: "800", lineHeight: 36, textShadowColor: "#0006", textShadowRadius: 8 },
  text: { color: "#ffffffd9", fontSize: 16, lineHeight: 24 },
  actions: { gap: 8, marginBottom: 12 },
  hint: { color: "#ffffffb3", textAlign: "center", fontSize: 13, marginBottom: 10 },
});
