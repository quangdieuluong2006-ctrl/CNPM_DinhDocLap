import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CodeBadge, Pill } from "../components/ui";
import { RATES } from "../core/narration";
import { formatTime, useT } from "../hooks";
import { store, useNarration } from "../state/store";
import { useColors } from "../theme";

// FE-07 trình phát đầy đủ: tiến trình, lùi/tới 10 giây (tệp âm thanh), phát/tạm dừng, phát lại, tốc độ, văn bản.
export default function PlayerScreen() {
  const n = useNarration();
  const c = useColors();
  const t = useT();
  const cur = n.current;
  if (!cur) {
    // Không phát được (thiết bị không có giọng đọc, không tải được tệp): vẫn hiện văn bản để khách đọc.
    const f = n.failed;
    const failedPlace = f ? store.places.find((p) => p.id === f.placeId) : undefined;
    return (
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.root}>
        {f && <CodeBadge code={f.code} size={72} />}
        {f && <Text style={[styles.title, { color: c.text }]}>{f.title}</Text>}
        {n.error && (
          <Text style={{ color: c.warn, textAlign: "center" }}>{n.error === "NO_VOICE" ? t("noVoice") : t("audioFailed")}</Text>
        )}
        {f && (
          <Pressable onPress={() => store.narration.request(f, "manual")} style={[styles.chip, { borderColor: c.border }]}>
            <Ionicons name="refresh" size={16} color={c.text} />
            <Text style={{ color: c.text }}>{t("retry")}</Text>
          </Pressable>
        )}
        {f && <Text style={[styles.text, { color: c.text }]}>{failedPlace?.content?.body ?? f.text}</Text>}
        {!f && (
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: c.primary, fontWeight: "700" }}>{t("close")}</Text>
          </Pressable>
        )}
      </ScrollView>
    );
  }
  const place = store.places.find((p) => p.id === cur.placeId);
  const progress = n.durationSec > 0 ? n.positionSec / n.durationSec : 0;
  const isAudio = cur.engine === "audio";
  const nextRate = RATES[(RATES.indexOf(n.rate as (typeof RATES)[number]) + 1) % RATES.length]!;

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.root}>
      <CodeBadge code={cur.code} size={72} />
      <Text style={[styles.title, { color: c.text }]}>{cur.title}</Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Pill tone="info" text={cur.lang.toUpperCase()} />
        {!isAudio && <Pill tone="warn" text={t("tts")} />}
      </View>

      <View style={styles.progressWrap}>
        <View style={[styles.track, { backgroundColor: c.border }]}>
          <View style={[styles.fill, { width: `${Math.min(100, progress * 100)}%`, backgroundColor: c.accent }]} />
        </View>
        <View style={styles.times}>
          <Text style={{ color: c.muted }}>{formatTime(n.positionSec)}</Text>
          <Text style={{ color: c.muted }}>{formatTime(n.durationSec)}</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <Pressable disabled={!isAudio} onPress={() => store.narration.seekBy(-10)} style={{ opacity: isAudio ? 1 : 0.3 }}>
          <Ionicons name="play-back" size={30} color={c.text} />
        </Pressable>
        <Pressable onPress={() => store.narration.toggle()} style={[styles.play, { backgroundColor: c.primary }]}>
          <Ionicons name={n.status === "playing" ? "pause" : "play"} size={36} color={c.primaryText} />
        </Pressable>
        <Pressable disabled={!isAudio} onPress={() => store.narration.seekBy(10)} style={{ opacity: isAudio ? 1 : 0.3 }}>
          <Ionicons name="play-forward" size={30} color={c.text} />
        </Pressable>
      </View>

      <View style={styles.row}>
        <Pressable onPress={() => store.narration.restart()} style={[styles.chip, { borderColor: c.border }]}>
          <Ionicons name="refresh" size={16} color={c.text} />
          <Text style={{ color: c.text }}>{t("replay")}</Text>
        </Pressable>
        <Pressable onPress={() => store.narration.setRate(nextRate)} style={[styles.chip, { borderColor: c.border }]}>
          <Text style={{ color: c.text }}>{t("speed")} {n.rate}×</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/language")} style={[styles.chip, { borderColor: c.border }]}>
          <Ionicons name="language" size={16} color={c.text} />
          <Text style={{ color: c.text }}>{cur.lang.toUpperCase()}</Text>
        </Pressable>
        <Pressable onPress={() => { store.narration.stop(); router.back(); }} style={[styles.chip, { borderColor: c.border }]}>
          <Ionicons name="stop" size={16} color={c.text} />
          <Text style={{ color: c.text }}>{t("stop")}</Text>
        </Pressable>
      </View>

      <Text style={[styles.text, { color: c.text }]}>{place?.content?.body ?? cur.text}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  root: { alignItems: "center", padding: 20, gap: 14 },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  progressWrap: { alignSelf: "stretch", gap: 6 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6 },
  times: { flexDirection: "row", justifyContent: "space-between" },
  controls: { flexDirection: "row", alignItems: "center", gap: 36 },
  play: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  text: { alignSelf: "stretch", fontSize: 16, lineHeight: 25, marginTop: 8 },
});
