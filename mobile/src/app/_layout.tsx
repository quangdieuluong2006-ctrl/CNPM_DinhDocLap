import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { translator } from "../i18n";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { store, uiLocaleOf, useApp } from "../state/store";
import { useColors } from "../theme";

export default function RootLayout() {
  const { ready, authNotice, settings, showCongrats } = useApp();
  const c = useColors();
  useEffect(() => {
    void store.init();
  }, []);
  // Admin khóa khách này → báo cho người dùng (nội dung vẫn nghe được). Phiên hết hạn thì app tự tạo khách mới, không báo.
  useEffect(() => {
    if (authNotice !== "ACCOUNT_LOCKED") return;
    const t = translator(uiLocaleOf(settings));
    Alert.alert(t("appName"), t("lockedNotice"), [
      { text: t("ok"), onPress: () => store.clearAuthNotice() },
    ]);
  }, [authNotice, settings]);
  // Nghe đủ mọi điểm → chúc mừng, mời xem lại lịch sử (FE-09, TC-22)
  useEffect(() => {
    if (!showCongrats) return;
    const t = translator(uiLocaleOf(settings));
    Alert.alert(t("congratsTitle"), t("congratsText").replace("{n}", String(store.places.length)), [
      { text: t("close"), style: "cancel", onPress: () => store.dismissCongrats() },
      { text: t("historyOpen"), onPress: () => { store.dismissCongrats(); router.push("/history"); } },
    ]);
  }, [showCongrats, settings]);
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
            {/* Nút quay lại chỉ hiện mũi tên: màn trước là nhóm tab có tên kỹ thuật "(tabs)", không được hiện tên đó cho khách */}
      <Stack screenOptions={{ headerTintColor: c.primary, contentStyle: { backgroundColor: c.bg }, headerBackButtonDisplayMode: "minimal" }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="language" options={{ title: "", presentation: "modal" }} />
        <Stack.Screen name="place/[code]" options={{ title: "" }} />
        <Stack.Screen name="player" options={{ title: "", presentation: "modal" }} />
        <Stack.Screen name="scan" options={{ title: "", presentation: "modal" }} />
        <Stack.Screen name="history" options={{ title: "" }} />
        <Stack.Screen name="p/[code]" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
