import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { translator } from "../i18n";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { store, uiLocaleOf, useApp } from "../state/store";
import { useColors } from "../theme";

export default function RootLayout() {
  const { ready, authNotice, settings } = useApp();
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
      <Stack screenOptions={{ headerTintColor: c.primary, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="language" options={{ title: "", presentation: "modal" }} />
        <Stack.Screen name="place/[code]" options={{ title: "" }} />
        <Stack.Screen name="player" options={{ title: "", presentation: "modal" }} />
        <Stack.Screen name="scan" options={{ title: "", presentation: "modal" }} />
        <Stack.Screen name="p/[code]" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
