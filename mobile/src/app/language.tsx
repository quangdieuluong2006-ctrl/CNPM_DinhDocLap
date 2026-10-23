import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Pill } from "../components/ui";
import { useT } from "../hooks";
import { fold } from "../i18n";
import type { Language } from "../services/api";
import { store, useApp } from "../state/store";
import { useColors } from "../theme";
import { getLocales } from "expo-localization";

const deviceLang = getLocales()[0]?.languageCode ?? "vi";

// FE-02: danh sách cuộn + ô tìm kiếm không phân biệt hoa thường và dấu, khớp tên Việt/Anh/bản ngữ/mã ISO.
export default function LanguageScreen() {
  const { languages, settings, online } = useApp();
  const c = useColors();
  const t = useT();
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    const sorted = [...languages].sort((a, b) => Number(b.code === deviceLang) - Number(a.code === deviceLang));
    const needle = fold(q.trim());
    if (!needle) return sorted;
    return sorted.filter((l) => l.code === needle || [l.nameVi, l.nameEn, l.nameNative].some((n) => fold(n).includes(needle)));
  }, [languages, q]);

  const choose = async (l: Language) => {
    await store.setLanguage(l.code);
    if (router.canGoBack()) router.back();
    else router.replace("/map");
  };

  return (
    <SafeAreaView edges={["bottom"]} style={[styles.root, { backgroundColor: c.bg }]}>
      <Text style={[styles.h1, { color: c.text }]}>{t("chooseLanguage")}</Text>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder={t("searchLanguage")}
        placeholderTextColor={c.muted}
        autoCorrect={false}
        style={[styles.search, { backgroundColor: c.card, color: c.text, borderColor: c.border }]}
      />
      {!online && languages.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={[styles.empty, { color: c.warn }]}>{t("offlineNoData")}</Text>
          <Button title={t("retry")} variant="ghost" onPress={() => void store.refreshLanguages()} />
        </View>
      )}
      <FlatList
        data={items}
        keyExtractor={(l) => l.code}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          languages.length > 0 ? (
            <View style={styles.emptyBox}>
              <Text style={[styles.empty, { color: c.muted }]}>{t("noLanguage")}</Text>
              <Button title={t("tryEnglish")} variant="ghost" onPress={() => setQ("en")} />
            </View>
          ) : undefined
        }
        renderItem={({ item: l }) => {
          const selected = settings.narrationLang === l.code;
          return (
            <Pressable
              onPress={() => void choose(l)}
              style={[styles.row, { backgroundColor: c.card, borderColor: selected ? c.primary : c.border }]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.native, { color: c.text }]}>{l.nameNative}</Text>
                <Text style={{ color: c.muted }}>
                  {settings.uiLocale === "vi" ? l.nameVi : l.nameEn} · {l.code}
                </Text>
                {l.pending > 0 && <Pill text={t("reviewing")} tone="info" />}
              </View>
              <Text style={{ color: c.muted, fontVariant: ["tabular-nums"] }}>
                {l.approved + l.pending} {t("points")}
              </Text>
            </Pressable>
          );
        }}
        contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
  h1: { fontSize: 22, fontWeight: "700", marginTop: 8, marginBottom: 12 },
  search: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5 },
  native: { fontSize: 18, fontWeight: "600" },
  emptyBox: { alignItems: "center", gap: 12, paddingTop: 24 },
  empty: { textAlign: "center", fontSize: 15 },
});
