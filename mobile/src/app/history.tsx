import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { Banner, CodeBadge, Pill } from "../components/ui";
import { dayLabel, groupByDay, type HistoryEntry, localParts, mergeHistory, type ServerVisit } from "../core/history";
import type { Trigger } from "../core/narration";
import { formatTime, useT } from "../hooks";
import type { TKey } from "../i18n";
import { store, useApp } from "../state/store";
import { useColors } from "../theme";

const TRIGGER_KEY: Record<Trigger, TKey> = {
  gps: "triggerGps",
  qr: "triggerQr",
  code: "triggerCode",
  manual: "triggerManual",
  simulated: "triggerSimulated",
};

// FE-10 Lịch sử tham quan: lượt nghe trên máy chủ (GET /me/visits) ghép với lượt nghe trên máy, chia theo ngày giờ Việt Nam.
// Mở từ Cài đặt và từ thẻ tiến độ ở tab Điểm. Mất mạng → chỉ hiện lượt trên máy kèm thông báo.
export default function HistoryScreen() {
  const app = useApp();
  const c = useColors();
  const t = useT();
  const [server, setServer] = useState<ServerVisit[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setServer(await store.fetchServerHistory());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Lượt nghe mới (vừa nghe xong) có trong app.localVisits ngay, không cần tải lại
  const sections = useMemo(() => {
    const lookup = (id: number) => {
      const p = store.places.find((x) => x.id === id);
      return p ? { code: p.code, title: p.content?.title ?? null } : undefined;
    };
    const entries = mergeHistory(server, app.localVisits, new Set(app.pendingVisitIds), lookup);
    const now = Date.now();
    return groupByDay(entries).map((g) => ({ ...g, title: dayLabel(g.day, now, { today: t("today"), yesterday: t("yesterday") }) }));
  }, [server, app.localVisits, app.pendingVisitIds, app.stored, t]);

  const offline = !loading && server === null;

  const renderItem = ({ item }: { item: HistoryEntry }) => (
    <Pressable
      disabled={!item.code}
      onPress={() => item.code && router.push(`/place/${item.code}`)}
      style={({ pressed }) => [styles.row, { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}
      accessibilityRole="button"
    >
      <Text style={[styles.time, { color: c.muted }]}>{localParts(item.startedAt).time}</Text>
      <CodeBadge code={item.code ?? "?"} size={36} color={item.completed ? c.done : c.primary} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.text, fontWeight: "600" }} numberOfLines={1}>
          {item.title ?? item.code ?? "—"}
        </Text>
        <Text style={{ color: c.muted, fontSize: 13 }}>
          {t(TRIGGER_KEY[item.trigger])} · {formatTime(item.listenedSec)} · {item.lang.toUpperCase()}
        </Text>
        {item.pending && <Pill text={t("historyPending")} tone="warn" />}
      </View>
      {item.completed && <Ionicons name="checkmark-circle" size={22} color={c.done} accessibilityLabel={t("historyCompleted")} />}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ title: t("historyTitle") }} />
      <SectionList
        sections={sections}
        keyExtractor={(e) => e.key}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => <Text style={[styles.day, { color: c.muted }]}>{section.title}</Text>}
        stickySectionHeadersEnabled={false}
        // Dải "Đang ngoại tuyến" nằm trong danh sách: trên iOS thanh tiêu đề trong suốt, danh sách tự chừa chỗ bên dưới
        // thanh tiêu đề, còn phần tử đặt ngoài danh sách sẽ bị đè lên giờ / pin của điện thoại.
        ListHeaderComponent={
          offline ? (
            <View style={styles.bannerWrap}>
              <Banner tone="warn" text={t("historyOffline")} action={{ title: t("retry"), onPress: () => void load() }} />
            </View>
          ) : undefined
        }
        contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ListEmptyComponent={
          loading ? undefined : (
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={40} color={c.muted} />
              <Text style={{ color: c.muted, textAlign: "center" }}>{t("historyEmpty")}</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
  time: { width: 44, fontVariant: ["tabular-nums"], fontWeight: "600" },
  day: { marginTop: 8, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  bannerWrap: { borderRadius: 12, overflow: "hidden" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 80 },
});
