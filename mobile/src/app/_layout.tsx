import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { translator } from "../i18n";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { store, useApp } from "../state/store";
import { useColors } from "../theme";

export default function RootLayout() {
  const { ready, authNotice, settings } = useApp();
  const c = useColors();
  useEffect(() => {
    void store.init();
  }, []);
  // Bị đăng xuất ngoài ý muốn (admin khóa tài khoản, phiên hết hạn) → báo cho người dùng
  useEffect(() => {
    if (!authNotice) return;
    const t = translator(settings.uiLocale);
    Alert.alert(t("account"), authNotice === "ACCOUNT_LOCKED" ? t("lockedNotice") : t("expiredNotice"), [
      { text: t("ok"), onPress: () => store.clearAuthNotice() },
    ]);
  }, [authNotice, settings.uiLocale]);
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
        <Stack.Screen name="login" options={{ title: "", presentation: "modal" }} />
        <Stack.Screen name="register" options={{ title: "", presentation: "modal" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
