import { Ionicons } from "@expo/vector-icons";
import { BottomTabBar, Tabs } from "expo-router/js-tabs";
import { View } from "react-native";
import { MiniPlayer } from "../../components/MiniPlayer";
import { useT } from "../../hooks";
import { useColors } from "../../theme";

// 4 tab: Bản đồ · Điểm · Nhóm · Cài đặt; trình phát thu nhỏ nằm ngay trên thanh tab (PRD v1.0, mục 5).
export default function TabsLayout() {
  const c = useColors();
  const t = useT();
  const icon = (name: "map" | "list" | "people" | "settings") =>
    ({ focused, size }: { focused: boolean; size: number }) => <Ionicons name={name} size={size} color={focused ? c.primary : c.muted} />;
  return (
    <Tabs
      tabBar={(props) => (
        <View>
          <MiniPlayer />
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border },
        headerStyle: { backgroundColor: c.card },
        headerTintColor: c.text,
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{ title: t("tabMap"), headerShown: false, tabBarIcon: icon("map") }}
      />
      <Tabs.Screen
        name="places"
        options={{ title: t("tabPlaces"), tabBarIcon: icon("list") }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t("tabSettings"), tabBarIcon: icon("settings") }}
      />
    </Tabs>
  );
}
