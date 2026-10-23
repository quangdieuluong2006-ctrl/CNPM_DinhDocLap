import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { store, useApp } from "../state/store";
import { useColors } from "../theme";

export default function RootLayout() {
  const { ready } = useApp();
  const c = useColors();
  useEffect(() => {
    void store.init();
  }, []);
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
      </Stack>
    </SafeAreaProvider>
  );
}
