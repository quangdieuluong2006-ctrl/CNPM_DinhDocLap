import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useT } from "../hooks";
import type { TKey } from "../i18n";
import { ApiError } from "../services/api";
import { store } from "../state/store";
import { useColors } from "../theme";
import { Button } from "./ui";

function errorKey(err: unknown): TKey {
  if (!(err instanceof ApiError)) return "errUnknown";
  switch (err.code) {
    case "AUTH_INVALID_CREDENTIALS":
      return "errInvalid";
    case "ACCOUNT_LOCKED":
      return "errLocked";
    case "EMAIL_TAKEN":
      return "errEmailTaken";
    case "RATE_LIMITED":
      return "errRate";
    case "VALIDATION_ERROR":
      return "errValidation";
    case "NETWORK_ERROR":
    case "DB_UNAVAILABLE":
      return "errNetwork";
    default:
      return "errUnknown";
  }
}

// FE-01 bước 2–3: đăng nhập (email, mật khẩu) / đăng ký (họ tên, email, mật khẩu ≥ 8 ký tự có chữ và số).
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const c = useColors();
  const t = useT();
  // next: đi tiếp vào app (đến từ màn Chào mừng); không có thì quay lại màn trước (Cài đặt, Nhóm…)
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<TKey | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await store.login(email.trim(), password);
      else await store.register({ email: email.trim(), password, fullName: fullName.trim() });
      if (next) router.replace(next === "/" ? "/" : "/map");
      else if (router.canGoBack()) router.back();
      else router.replace("/");
    } catch (err) {
      setError(errorKey(err));
    } finally {
      setBusy(false);
    }
  };

  const input = [styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }];
  const canSubmit = email.trim() !== "" && password !== "" && (mode === "login" || fullName.trim() !== "");

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: c.text }]}>{mode === "login" ? t("login") : t("register")}</Text>
        {mode === "register" && (
          <View style={styles.field}>
            <Text style={[styles.label, { color: c.text }]}>{t("fullName")}</Text>
            <TextInput value={fullName} onChangeText={setFullName} autoComplete="name" maxLength={100} style={input} />
          </View>
        )}
        <View style={styles.field}>
          <Text style={[styles.label, { color: c.text }]}>{t("email")}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            style={input}
          />
        </View>
        <View style={styles.field}>
          <Text style={[styles.label, { color: c.text }]}>{t("password")}</Text>
          <View>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              style={[input, { paddingRight: 64 }]}
              onSubmitEditing={() => canSubmit && void submit()}
            />
            <Pressable onPress={() => setShow((v) => !v)} style={styles.eye} hitSlop={8}>
              <Text style={{ color: c.primary, fontWeight: "700" }}>{show ? t("hide") : t("show")}</Text>
            </Pressable>
          </View>
          {mode === "register" && <Text style={{ color: c.muted, fontSize: 12 }}>{t("passwordHint")}</Text>}
        </View>
        {error && <Text style={[styles.error, { color: c.warn, backgroundColor: c.warnBg }]}>{t(error)}</Text>}
        <Button title={busy ? "…" : mode === "login" ? t("login") : t("register")} disabled={!canSubmit || busy} onPress={() => void submit()} />
        <Pressable
          onPress={() => router.replace({ pathname: mode === "login" ? "/register" : "/login", params: next ? { next } : {} })}
          style={styles.switch}
        >
          <Text style={{ color: c.muted }}>
            {mode === "login" ? t("noAccount") : t("haveAccount")}{" "}
            <Text style={{ color: c.primary, fontWeight: "700" }}>{mode === "login" ? t("register") : t("login")}</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 20, gap: 16 },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 4 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  eye: { position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" },
  error: { padding: 12, borderRadius: 10, fontSize: 14, overflow: "hidden" },
  switch: { alignItems: "center", paddingVertical: 8 },
});
