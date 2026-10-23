import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, CodeBadge, Pill } from "../../components/ui";
import { formatDistance } from "../../core/geo";
import { useT } from "../../hooks";
import type { TKey } from "../../i18n";
import { store, useApp, useNarration } from "../../state/store";
import { useColors } from "../../theme";

// FE-04 chi tiết điểm: tiêu đề, tóm tắt, nút Nghe, văn bản đầy đủ, kiểu kích hoạt, nhãn dự phòng/chờ duyệt.
export default function PlaceDetail() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const app = useApp();
  const n = useNarration();
  const c = useColors();
  const t = useT();
  const place = store.findPlace(code);

  if (!place) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={{ color: c.text, fontSize: 18 }}>{t("notFound")} {code}</Text>
      </View>
    );
  }
  const content = place.content;
  const isCurrent = n.current?.placeId === place.id;
  const dist = place.trigger === "gps" ? store.distanceTo(place) : null;
  const image = store.api.mediaUrl(place.imageUrl);

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen options={{ title: place.code }} />
      {image ? <Image source={{ uri: image }} style={styles.hero} /> : <View style={[styles.hero, { backgroundColor: c.primary, opacity: 0.12 }]} />}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <CodeBadge code={place.code} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: c.text }]}>{content?.title ?? place.code}</Text>
            <Text style={{ color: c.muted }}>{t(place.zone as TKey)}{dist !== null ? ` · ${formatDistance(dist)}` : ""}</Text>
          </View>
        </View>
        <View style={styles.pills}>
          <Pill tone="info" text={place.trigger === "gps" ? t("autoTrigger") : t("qrTrigger")} />
          {content?.status === "pending" && <Pill tone="info" text={t("reviewing")} />}
          {content?.isFallback && <Pill tone="warn" text={`${t("showingIn")} ${content.lang.toUpperCase()}`} />}
          {app.completed.includes(place.id) && <Pill tone="done" text="✓" />}
        </View>
        {content && (
          <Button
            title={isCurrent ? (n.status === "playing" ? "❚❚" : t("listen")) : t("listen")}
            icon={<Ionicons name={isCurrent && n.status === "playing" ? "pause" : "play"} size={18} color={c.primaryText} />}
            onPress={() => {
              if (isCurrent) store.narration.toggle();
              else store.play(place, "manual");
              router.push("/player");
            }}
          />
        )}
        <Text style={[styles.summary, { color: c.text }]}>{content?.summary}</Text>
        <Text style={[styles.text, { color: c.text }]}>{content?.body}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { width: "100%", height: 180 },
  body: { padding: 16, gap: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  summary: { fontSize: 16, fontWeight: "600", lineHeight: 23 },
  text: { fontSize: 16, lineHeight: 25 },
});
