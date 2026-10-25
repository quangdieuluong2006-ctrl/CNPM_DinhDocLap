import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, CodeBadge } from "../../components/ui";
import { useT } from "../../hooks";
import type { TKey } from "../../i18n";
import { ApiError, type Tour, type TourMember } from "../../services/api";
import { store, useApp } from "../../state/store";
import { useColors } from "../../theme";

const ERRORS: Record<string, TKey> = {
  TOUR_NOT_FOUND: "tourErrNotFound",
  TOUR_ENDED: "tourErrEnded",
  TOUR_FULL: "tourErrFull",
  ALREADY_IN_TOUR: "tourErrOther",
};
const TOUR_EVENTS = ["tour.member.joined", "tour.member.left", "tour.member.updated", "tour.ended"];

// FE-10 Nhóm tham quan: khách nhập mã 6 ký tự để tham gia; hướng dẫn viên tạo nhóm, chia sẻ mã, kết thúc nhóm.
// Danh sách thành viên cập nhật theo sự kiện Socket.IO tour.* (PRD v1.0, mục 4.7, 12); chỉ chia sẻ điểm đang nghe.
export default function TourScreen() {
  const c = useColors();
  const t = useT();
  const app = useApp();
  const [tour, setTour] = useState<Tour | null>(null);
  const [members, setMembers] = useState<TourMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<TKey | null>(null);
  const [busy, setBusy] = useState(false);
  const loggedIn = app.authStatus === "authenticated";
  const canCreate = app.user?.role === "guide" || app.user?.role === "admin";

  const load = useCallback(async () => {
    if (!loggedIn) return;
    setLoading(true);
    try {
      if (!(await store.ensureSession())) return;
      const mine = await store.api.myTour();
      setTour(mine);
      setMembers(mine ? (await store.api.tourMembers(mine.id)).members : []);
    } catch {
      // mất mạng: giữ dữ liệu đang hiện, lần sau tải lại
    } finally {
      setLoading(false);
    }
  }, [loggedIn]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Sự kiện realtime của nhóm → tải lại danh sách; mất kết nối Socket.IO → tự tải lại mỗi 10 giây
  useEffect(() => {
    if (!tour) return;
    const socket = store.realtime.current;
    const onEvent = () => void load();
    for (const e of TOUR_EVENTS) socket?.on(e, onEvent);
    const poll = app.realtimeConnected ? null : setInterval(onEvent, 10_000);
    return () => {
      for (const e of TOUR_EVENTS) socket?.off(e, onEvent);
      if (poll) clearInterval(poll);
    };
  }, [tour?.id, app.realtimeConnected, load]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await store.ensureSession();
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? (ERRORS[err.code] ?? "errUnknown") : "errNetwork");
    } finally {
      setBusy(false);
    }
  };

  if (!loggedIn) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Ionicons name="people-outline" size={56} color={c.muted} />
        <Text style={{ color: c.muted, textAlign: "center", fontSize: 15 }}>{t("tourNeedLogin")}</Text>
        <Button title={t("login")} onPress={() => router.push("/login")} />
      </View>
    );
  }

  const input = [styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }];
  const isGuideOfTour = tour?.guide.id === app.user?.id || app.user?.role === "admin";
  const titleOf = (placeId: number | null) => store.places.find((p) => p.id === placeId)?.content?.title;

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.root}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      keyboardShouldPersistTaps="handled"
    >
      {error && <Text style={[styles.error, { color: c.warn, backgroundColor: c.warnBg }]}>{t(error)}</Text>}

      {tour ? (
        <>
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.label, { color: c.muted }]}>{t("tourTitle")}</Text>
            <Text style={[styles.h1, { color: c.text }]}>{tour.name}</Text>
            <Text style={{ color: c.muted }}>
              {t("tourGuide")}: {tour.guide.fullName} · {t("tourMembers")}: {tour.memberCount}/{tour.maxMembers}
            </Text>
            <View style={styles.codeRow}>
              <View>
                <Text style={[styles.label, { color: c.muted }]}>{t("tourCode")}</Text>
                <Text style={[styles.code, { color: c.primary }]}>{tour.code}</Text>
              </View>
              <Pressable
                onPress={() => void Share.share({ message: `${t("tourShareMessage")} ${tour.code}` })}
                style={[styles.chip, { borderColor: c.primary }]}
              >
                <Ionicons name="share-outline" size={16} color={c.primary} />
                <Text style={{ color: c.primary, fontWeight: "700" }}>{t("tourShare")}</Text>
              </Pressable>
            </View>
            <Text style={{ color: c.muted, fontSize: 12 }}>🔒 {t("tourPrivacy")}</Text>
          </View>

          <Text style={[styles.section, { color: c.muted }]}>{t("tourMembers")}</Text>
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, padding: 0 }]}>
            {members.map((m, i) => (
              <View key={m.userId} style={[styles.member, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border }]}>
                <View style={[styles.dot, { backgroundColor: m.online ? c.done : c.border }]} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontWeight: "600" }}>
                    {m.fullName}
                    {m.userId === app.user?.id ? ` (${t("you")})` : ""}
                    {m.isGuide ? ` · ${t("tourGuide")}` : ""}
                  </Text>
                  {m.currentPlaceCode && (
                    <Text style={{ color: c.muted, fontSize: 13 }} numberOfLines={1}>
                      {t("tourListening")} {m.currentPlaceCode} · {titleOf(m.currentPlaceId) ?? ""}
                    </Text>
                  )}
                </View>
                {m.currentPlaceCode && (
                  <Pressable onPress={() => router.push(`/place/${m.currentPlaceCode}`)}>
                    <CodeBadge code={m.currentPlaceCode} size={34} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <Button title={t("tourLeave")} variant="ghost" disabled={busy} onPress={() => void run(() => store.api.leaveTour(tour.id))} />
            {isGuideOfTour && (
              <Button
                title={t("tourEnd")}
                disabled={busy}
                style={{ backgroundColor: c.warn, borderColor: c.warn }}
                onPress={() =>
                  Alert.alert(t("tourEnd"), t("tourEndConfirm"), [
                    { text: t("cancel"), style: "cancel" },
                    { text: t("tourEnd"), style: "destructive", onPress: () => void run(() => store.api.endTour(tour.id)) },
                  ])
                }
              />
            )}
          </View>
        </>
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.h2, { color: c.text }]}>{t("tourJoinTitle")}</Text>
            <Text style={{ color: c.muted }}>{t("tourJoinHint")}</Text>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="• • • • • •"
              placeholderTextColor={c.muted}
              style={[input, styles.codeInput]}
            />
            <Button title={t("tourJoin")} disabled={code.length !== 6 || busy} onPress={() => void run(() => store.api.joinTour(code))} />
          </View>

          {canCreate && (
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.h2, { color: c.text }]}>{t("tourCreateTitle")}</Text>
              <TextInput value={name} onChangeText={setName} maxLength={100} placeholder={t("tourName")} placeholderTextColor={c.muted} style={input} />
              <Button title={t("tourCreate")} disabled={!name.trim() || busy} onPress={() => void run(() => store.api.createTour(name.trim(), 50))} />
            </View>
          )}
          <Text style={{ color: c.muted, fontSize: 12, textAlign: "center" }}>🔒 {t("tourPrivacy")}</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 10, overflow: "hidden" },
  label: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  h1: { fontSize: 22, fontWeight: "800" },
  h2: { fontSize: 17, fontWeight: "700" },
  codeRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  code: { fontSize: 32, fontWeight: "800", letterSpacing: 4, fontVariant: ["tabular-nums"] },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  section: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", marginTop: 4, letterSpacing: 0.5 },
  member: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  actions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  codeInput: { fontSize: 26, fontWeight: "800", letterSpacing: 6, textAlign: "center" },
  error: { padding: 12, borderRadius: 10, overflow: "hidden" },
});
