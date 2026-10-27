import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, CodeBadge, FadeIn, Pill, ZoneTile } from "../../components/ui";
import { formatDistance } from "../../core/geo";
import { useT } from "../../hooks";
import type { TKey } from "../../i18n";
import { placePhoto } from "../../photos";
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
  const photo = placePhoto(place, (u) => store.api.mediaUrl(u));

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen options={{ title: place.code }} />
      <View style={styles.hero}>
        {photo ? <Image source={photo.source} style={styles.heroImg} resizeMode="cover" /> : <ZoneTile zone={place.zone} iconSize={64} style={StyleSheet.absoluteFill} />}
        <View style={styles.heroShade} />
        <View style={styles.heroBadge}>
          <CodeBadge code={place.code} size={52} />
        </View>
        {photo && photo.credit !== "" && (
          <Text style={styles.credit}>
            {t("photoBy")}: {photo.credit ?? t("photoCollected")}
          </Text>
        )}
      </View>
      <FadeIn style={styles.body}>
        <View style={styles.titleRow}>
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
      </FadeIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { width: "100%", height: 230, overflow: "hidden" },
  heroImg: { width: "100%", height: "100%" },
  heroShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 80, backgroundColor: "#00000040" },
  heroBadge: { position: "absolute", left: 16, bottom: 14, borderRadius: 999, borderWidth: 3, borderColor: "#ffffffcc" },
  credit: { position: "absolute", right: 10, bottom: 8, color: "#ffffffcc", fontSize: 11 },
  body: { padding: 16, gap: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  summary: { fontSize: 16, fontWeight: "600", lineHeight: 23 },
  text: { fontSize: 16, lineHeight: 25 },
});
