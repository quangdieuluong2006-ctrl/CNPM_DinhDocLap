import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SuggestionCard } from "../../components/MiniPlayer";
import { PlaceMap } from "../../components/PlaceMap";
import { Banner, CodeBadge, Pill } from "../../components/ui";
import { formatDistance, offsetM } from "../../core/geo";
import { useT } from "../../hooks";
import type { Place } from "../../services/api";
import { store, useApp, useNarration } from "../../state/store";
import { useColors } from "../../theme";

// FE-03 Bản đồ khuôn viên + FE-05 tự động thuyết minh + FE-11 chế độ mô phỏng.
export default function MapScreen() {
  const app = useApp();
  const n = useNarration();
  const c = useColors();
  const t = useT();
  const [selected, setSelected] = useState<Place | null>(null);
  const [recenter, setRecenter] = useState(0);
  const [routing, setRouting] = useState(false);
  const places = store.places;
  const simulate = app.settings.simulate;

  const startRoute = () => {
    const outdoor = places.filter((p) => p.trigger === "gps").sort((a, b) => a.sortOrder - b.sortOrder);
    const first = outdoor[0];
    if (!first) return;
    // Bắt đầu ngoài cổng chính (cách điểm đầu 70 m về phía Bắc – đại lộ Lê Duẩn) như khách thật đi vào.
    store.sim.teleport(offsetM(first, 70, 0));
    setRouting(true);
    setTimeout(() => store.sim.playRoute(outdoor, 4, () => setRouting(false)), 3500);
  };

  const dist = selected ? store.distanceTo(selected) : null;

  return (
    <View style={styles.root}>
      <PlaceMap
        places={places}
        fix={app.fix}
        playingId={n.current?.placeId ?? null}
        completed={app.completed}
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
        onMapPress={simulate ? (p) => store.sim.teleport(p) : undefined}
        recenterKey={recenter}
      />

      <SafeAreaView edges={["top"]} style={styles.top} pointerEvents="box-none">
        {simulate && (
          <View style={[styles.simBar, { backgroundColor: c.warn }]}>
            <Text style={styles.simText}>{t("simulated")}</Text>
            <Text style={styles.simHint}>{t("simulateHint")}</Text>
          </View>
        )}
        {app.locationError === "PERMISSION_DENIED" && !simulate && (
          <Banner tone="warn" text={t("locationDenied")} action={{ title: t("openSettings"), onPress: () => void Linking.openSettings() }} />
        )}
        {store.isFarAway && <Banner tone="info" text={t("farAway")} />}
        {app.weakGps && !simulate && <Banner tone="warn" text={t("weakGps")} />}
        {!app.stored && <Banner tone="warn" text={app.loadingBundle ? t("loading") : t("offlineNoData")} />}
        <SuggestionCard />
      </SafeAreaView>

      <View style={styles.fabs} pointerEvents="box-none">
        {simulate && (
          <Pressable
            onPress={() => (routing ? (store.sim.stopRoute(), setRouting(false)) : startRoute())}
            style={[styles.fab, { backgroundColor: c.warn }]}
          >
            <Ionicons name={routing ? "stop" : "walk"} size={20} color="#fff" />
            <Text style={styles.fabText}>{routing ? t("stopRoute") : t("playRoute")}</Text>
          </Pressable>
        )}
        <Pressable accessibilityLabel={t("myLocation")} onPress={() => setRecenter((k) => k + 1)} style={[styles.round, { backgroundColor: c.card }]}>
          <Ionicons name="locate" size={22} color={c.primary} />
        </Pressable>
        <Pressable onPress={() => router.push("/scan")} style={[styles.fab, { backgroundColor: c.primary }]}>
          <Ionicons name="qr-code" size={20} color={c.primaryText} />
          <Text style={[styles.fabText, { color: c.primaryText }]}>{t("scan")}</Text>
        </Pressable>
      </View>

      {selected && (
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Pressable style={styles.cardMain} onPress={() => router.push(`/place/${selected.code}`)}>
            <CodeBadge code={selected.code} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={[styles.cardTitle, { color: c.text }]}>{selected.content?.title ?? selected.code}</Text>
              <Text numberOfLines={2} style={{ color: c.muted, fontSize: 13 }}>{selected.content?.summary}</Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                {dist !== null && <Pill tone="info" text={formatDistance(dist)} />}
                {app.completed.includes(selected.id) && <Pill tone="done" text="✓" />}
              </View>
            </View>
          </Pressable>
          <View style={styles.cardActions}>
            <Pressable onPress={() => store.play(selected, "manual")} style={[styles.listen, { backgroundColor: c.primary }]}>
              <Ionicons name="play" size={18} color={c.primaryText} />
              <Text style={{ color: c.primaryText, fontWeight: "700" }}>{t("listen")}</Text>
            </Pressable>
            <Pressable hitSlop={10} onPress={() => setSelected(null)}>
              <Ionicons name="close" size={22} color={c.muted} />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { position: "absolute", top: 0, left: 0, right: 0 },
  simBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 6 },
  simText: { color: "#fff", fontWeight: "800", letterSpacing: 1 },
  simHint: { color: "#fff", fontSize: 12 },
  fabs: { position: "absolute", right: 14, bottom: 14, alignItems: "flex-end", gap: 10 },
  fab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 999, elevation: 3, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  fabText: { color: "#fff", fontWeight: "700" },
  round: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", elevation: 3, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  card: { position: "absolute", left: 12, right: 12, bottom: 12, borderRadius: 16, borderWidth: 1, padding: 12, gap: 10, marginRight: 0 },
  cardMain: { flexDirection: "row", gap: 12, alignItems: "center" },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  listen: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
});
