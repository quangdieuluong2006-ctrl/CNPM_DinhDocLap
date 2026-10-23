import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useT } from "../hooks";
import { store, useNarration } from "../state/store";
import { useColors } from "../theme";
import { CodeBadge } from "./ui";

// Trình phát thu nhỏ luôn nằm trên thanh tab khi có bài đang phát (PRD v1.0, FE-07).
export function MiniPlayer() {
  const n = useNarration();
  const c = useColors();
  const t = useT();
  const cur = n.current;
  if (!cur) return null;
  const progress = n.durationSec > 0 ? n.positionSec / n.durationSec : 0;
  return (
    <Pressable onPress={() => router.push("/player")} style={[styles.wrap, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={[styles.progress, { width: `${Math.min(100, progress * 100)}%`, backgroundColor: c.accent }]} />
      <CodeBadge code={cur.code} size={36} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.title, { color: c.text }]}>{cur.title}</Text>
        <Text style={[styles.sub, { color: c.muted }]}>{cur.engine === "tts" ? t("tts") : cur.lang.toUpperCase()}</Text>
      </View>
      <Pressable accessibilityLabel="play-pause" hitSlop={10} onPress={() => store.narration.toggle()}>
        <Ionicons name={n.status === "playing" ? "pause" : "play"} size={28} color={c.primary} />
      </Pressable>
      <Pressable accessibilityLabel="stop" hitSlop={10} onPress={() => store.narration.stop()}>
        <Ionicons name="close" size={24} color={c.muted} />
      </Pressable>
    </Pressable>
  );
}

// Thẻ gợi ý khi GPS phát hiện điểm mới nhưng đang phát bài khác (không cắt ngang – mục 4.3.5).
export function SuggestionCard() {
  const n = useNarration();
  const c = useColors();
  const t = useT();
  const s = n.suggestion;
  if (!s) return null;
  return (
    <View style={[styles.suggest, { backgroundColor: c.card, borderColor: c.accent }]}>
      <CodeBadge code={s.code} size={36} color={c.accent} />
      <View style={styles.text}>
        <Text style={[styles.sub, { color: c.muted }]}>{t("nearPlace")}</Text>
        <Text numberOfLines={1} style={[styles.title, { color: c.text }]}>{s.title}</Text>
      </View>
      <Pressable onPress={() => store.narration.acceptSuggestion()} style={[styles.chip, { backgroundColor: c.accent }]}>
        <Text style={styles.chipText}>{t("listenNow")}</Text>
      </Pressable>
      <Pressable hitSlop={10} onPress={() => store.narration.dismissSuggestion()}>
        <Ionicons name="close" size={20} color={c.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, overflow: "hidden" },
  progress: { position: "absolute", left: 0, top: 0, height: 3 },
  text: { flex: 1 },
  title: { fontSize: 15, fontWeight: "600" },
  sub: { fontSize: 12 },
  suggest: { flexDirection: "row", alignItems: "center", gap: 10, margin: 10, padding: 10, borderRadius: 14, borderWidth: 1.5 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  chipText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
