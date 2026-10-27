import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from "react-native";
import { FadeIn, Pill, PlaceThumb } from "../../components/ui";
import { bearingDeg, formatDistance } from "../../core/geo";
import { useT } from "../../hooks";
import { fold, type TKey } from "../../i18n";
import { zoneStyle } from "../../photos";
import type { Place } from "../../services/api";
import { store, useApp } from "../../state/store";
import { useColors } from "../../theme";

const ZONES: Place["zone"][] = ["outdoor", "ground", "floor1", "floor2", "rooftop", "basement"];
const ARROWS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];

// FE-04 danh sách theo khu vực + FE-09 tiến độ và điểm tiếp theo.
export default function PlacesScreen() {
  const app = useApp();
  const c = useColors();
  const t = useT();
  const [q, setQ] = useState("");
  const places = store.places;

  const sections = useMemo(() => {
    const needle = fold(q.trim());
    const match = (p: Place) =>
      !needle || p.code.includes(needle) || fold(p.content?.title ?? "").includes(needle) || fold(p.content?.summary ?? "").includes(needle);
    return ZONES.map((z) => ({ zone: z, data: places.filter((p) => p.zone === z && match(p)).sort((a, b) => a.sortOrder - b.sortOrder) }))
      .filter((s) => s.data.length > 0);
  }, [places, q]);

  const done = places.filter((p) => app.completed.includes(p.id)).length;
  const next = [...places].sort((a, b) => a.sortOrder - b.sortOrder).find((p) => !app.completed.includes(p.id));
  const nextDist = next && next.trigger === "gps" ? store.distanceTo(next) : null;
  const nextArrow = next && app.fix && next.trigger === "gps" ? ARROWS[Math.round(bearingDeg(app.fix, next) / 45) % 8] : "";

  return (
    <SectionList
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 16, gap: 8 }}
      sections={sections}
      keyExtractor={(p) => String(p.id)}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          <View style={[styles.progressCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={{ color: c.text, fontWeight: "700", fontSize: 16 }}>
              {t("progress")} {done}/{places.length}
            </Text>
            <View style={[styles.bar, { backgroundColor: c.border }]}>
              <View style={[styles.barFill, { width: `${places.length ? (done * 100) / places.length : 0}%`, backgroundColor: c.done }]} />
            </View>
            {next && (
              <Pressable onPress={() => router.push(`/place/${next.code}`)} style={styles.nextRow}>
                <Text style={{ color: c.muted }}>{t("nextPlace")}:</Text>
                <Text style={{ color: c.primary, fontWeight: "700", flex: 1 }} numberOfLines={1}>
                  {next.code} · {next.content?.title}
                </Text>
                {nextDist !== null && <Text style={{ color: c.muted }}>{nextArrow} {formatDistance(nextDist)}</Text>}
              </Pressable>
            )}
          </View>
          <View style={[styles.search, { backgroundColor: c.card, borderColor: c.border }]}>
            <Ionicons name="search" size={18} color={c.muted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t("searchPlace")}
              placeholderTextColor={c.muted}
              style={{ flex: 1, color: c.text, fontSize: 16, paddingVertical: 10 }}
            />
            <Pressable onPress={() => router.push("/scan")} hitSlop={8}>
              <Ionicons name="qr-code" size={20} color={c.primary} />
            </Pressable>
          </View>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionRow}>
          <Ionicons name={zoneStyle(section.zone).icon} size={14} color={c.muted} />
          <Text style={[styles.section, { color: c.muted }]}>
            {t(section.zone as TKey)} · {section.data.length}
          </Text>
        </View>
      )}
      renderItem={({ item: p, index }) => {
        const dist = p.trigger === "gps" ? store.distanceTo(p) : null;
        const isDone = app.completed.includes(p.id);
        return (
          <FadeIn delay={Math.min(index, 8) * 50}>
          <Pressable
            onPress={() => router.push(`/place/${p.code}`)}
            style={({ pressed }) => [styles.row, { backgroundColor: c.card, borderColor: c.border, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          >
            <PlaceThumb place={p} dim={isDone} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text numberOfLines={1} style={{ color: c.text, fontWeight: "600", fontSize: 16 }}>{p.content?.title ?? p.code}</Text>
              <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13 }}>{p.content?.summary}</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {p.content?.status === "pending" && <Pill tone="info" text={t("reviewing")} />}
                {p.content?.isFallback && <Pill tone="warn" text={`${t("showingIn")} ${p.content.lang.toUpperCase()}`} />}
              </View>
            </View>
            {dist !== null && <Text style={{ color: c.muted, fontSize: 13 }}>{formatDistance(dist)}</Text>}
            {isDone ? <Ionicons name="checkmark-circle" size={20} color={c.done} /> : <Ionicons name="chevron-forward" size={18} color={c.border} />}
          </Pressable>
          </FadeIn>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  progressCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  bar: { height: 8, borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  nextRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, marginBottom: 4 },
  section: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
});
