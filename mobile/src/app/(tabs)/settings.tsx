import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Button } from "../../components/ui";
import { useT } from "../../hooks";
import { defaultApiUrl } from "../../services/config";
import { deleteLanguageData, listDownloadedLanguages } from "../../services/storage";
import { store, useApp } from "../../state/store";
import { useColors } from "../../theme";

function formatBytes(b: number): string {
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

// Cài đặt: ngôn ngữ, tự động thuyết minh (FE-12), chế độ mô phỏng (FE-11), máy chủ, dữ liệu ngoại tuyến (FE-08).
export default function SettingsScreen() {
  const app = useApp();
  const c = useColors();
  const t = useT();
  const s = app.settings;
  const [apiUrl, setApiUrl] = useState(s.apiUrl ?? defaultApiUrl());
  const [downloaded, setDownloaded] = useState(() => listDownloadedLanguages());
  const lang = app.languages.find((l) => l.code === s.narrationLang);
  const bundle = app.stored?.bundle;
  const audioCount = bundle?.places.filter((p) => p.content?.audioUrl).length ?? 0;

  const Row = (p: { label: string; children: React.ReactNode }) => (
    <View style={[styles.row, { borderColor: c.border }]}>
      <Text style={[styles.label, { color: c.text }]}>{p.label}</Text>
      {p.children}
    </View>
  );

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.root}>
      {/* FE-01: tài khoản – đăng nhập để lưu lịch sử, tham gia nhóm và hiện "đang hoạt động" trên Web Admin */}
      <View style={[styles.card, styles.account, { backgroundColor: c.card, borderColor: c.border }]}>
        {app.authStatus === "authenticated" && app.user ? (
          <>
            <View style={[styles.avatar, { backgroundColor: c.primary }]}>
              <Text style={styles.avatarText}>{app.user.fullName.trim().charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontWeight: "700", fontSize: 16 }}>{app.user.fullName}</Text>
              <Text style={{ color: c.muted, fontSize: 13 }}>{app.user.email}</Text>
              <Text style={{ color: app.realtimeConnected ? c.done : c.muted, fontSize: 12, marginTop: 2 }}>
                ● {app.realtimeConnected ? t("online") : t("offline")}
              </Text>
            </View>
            <Pressable onPress={() => void store.logout()} hitSlop={8}>
              <Text style={{ color: c.warn, fontWeight: "700" }}>{t("logout")}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontWeight: "700" }}>{t("guestMode")}</Text>
              <Text style={{ color: c.muted, fontSize: 13 }}>{t("accountHint")}</Text>
            </View>
            <Button title={t("login")} onPress={() => router.push("/login")} />
          </>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <Row label={t("settingsLanguage")}>
          <Pressable onPress={() => router.push("/language")}>
            <Text style={{ color: c.primary, fontWeight: "700" }}>{lang?.nameNative ?? s.narrationLang ?? "—"} ›</Text>
          </Pressable>
        </Row>
        <Row label={t("settingsUi")}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["vi", "en"] as const).map((l) => (
              <Pressable key={l} onPress={() => void store.updateSettings({ uiLocale: l })} style={[styles.seg, { borderColor: c.primary, backgroundColor: s.uiLocale === l ? c.primary : "transparent" }]}>
                <Text style={{ color: s.uiLocale === l ? c.primaryText : c.primary, fontWeight: "700" }}>{l.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </Row>
        <Row label={t("settingsAutoPlay")}>
          <Switch value={s.autoPlay} onValueChange={(v) => void store.updateSettings({ autoPlay: v })} />
        </Row>
        <Row label={t("settingsSimulate")}>
          <Switch value={s.simulate} onValueChange={(v) => void store.updateSettings({ simulate: v })} trackColor={{ true: c.warn }} />
        </Row>
      </View>

      <Text style={[styles.h2, { color: c.muted }]}>{t("settingsOffline")}</Text>
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <Row label={t("version")}>
          <Text style={{ color: c.muted }}>{bundle ? `v${bundle.version} · ${bundle.lang.toUpperCase()}` : "—"}</Text>
        </Row>
        {downloaded.map((d) => (
          <Row key={d.lang} label={`${d.lang.toUpperCase()} · ${formatBytes(d.bytes)}`}>
            <Pressable
              onPress={() =>
                Alert.alert(t("deleteData"), d.lang.toUpperCase(), [
                  { text: t("close"), style: "cancel" },
                  { text: t("deleteData"), style: "destructive", onPress: () => { deleteLanguageData(d.lang); setDownloaded(listDownloadedLanguages()); } },
                ])
              }
            >
              <Text style={{ color: c.warn, fontWeight: "700" }}>{t("deleteData")}</Text>
            </Pressable>
          </Row>
        ))}
        <View style={styles.actions}>
          <Button title={t("update")} variant="ghost" onPress={() => void store.refreshBundle().then(() => setDownloaded(listDownloadedLanguages()))} />
          {audioCount > 0 ? (
            <Button
              title={app.download ? `${app.download.done}/${app.download.total}` : t("downloadAudio")}
              disabled={!!app.download}
              onPress={() => void store.downloadOfflineAudio().then(() => setDownloaded(listDownloadedLanguages()))}
            />
          ) : (
            <Text style={{ color: c.muted, fontSize: 13 }}>{t("noAudioFiles")}</Text>
          )}
        </View>
        <Row label={t("pendingVisits")}>
          <Text style={{ color: c.muted }}>{app.pendingVisits}</Text>
        </Row>
      </View>

      <Text style={[styles.h2, { color: c.muted }]}>{t("settingsServer")}</Text>
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, padding: 14, gap: 10 }]}>
        <TextInput
          value={apiUrl}
          onChangeText={setApiUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={[styles.input, { color: c.text, borderColor: c.border }]}
        />
        <Text style={{ color: app.online ? c.done : c.warn, fontSize: 13 }}>{app.online ? "● Online" : "● Offline"}</Text>
        <Text style={{ color: c.muted, fontSize: 12 }}>
          {t("apiAuto")}: {defaultApiUrl()}
          {s.apiUrl ? "" : ` (${t("inUse")})`}
        </Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Button
            title={t("save")}
            onPress={() => {
              // Chỉ lưu khi khác địa chỉ tự động: nếu lưu cố định, lần sau máy tính đổi mạng (đổi IP) app sẽ gọi sai địa chỉ
              const url = apiUrl.trim().replace(/\/$/, "");
              void store.updateSettings({ apiUrl: url && url !== defaultApiUrl() ? url : null });
            }}
          />
          {s.apiUrl && (
            <Button
              title={t("useAuto")}
              variant="ghost"
              onPress={() => {
                setApiUrl(defaultApiUrl());
                void store.updateSettings({ apiUrl: null });
              }}
            />
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, gap: 10, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  account: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 15, flex: 1 },
  seg: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  h2: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", marginTop: 12, letterSpacing: 0.5 },
  actions: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, flexWrap: "wrap" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
});
