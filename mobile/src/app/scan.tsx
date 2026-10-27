import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/ui";
import { parsePlaceCode } from "../core/qr";
import { useT } from "../hooks";
import type { Trigger } from "../core/narration";
import { store } from "../state/store";
import { useColors } from "../theme";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

// FE-06: quét QR tại phòng hoặc nhập số điểm 3 chữ số (dự phòng khi camera không quét được).
export default function ScanScreen() {
  const c = useColors();
  const t = useT();
  const [perm, requestPerm] = useCameraPermissions();
  const [mode, setMode] = useState<"camera" | "keypad">("camera");
  const [digits, setDigits] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const handled = useRef(false);

  const open = (code: string, trigger: Trigger) => {
    const place = store.findPlace(code);
    if (!place) {
      setMessage(`${t("notFound")} ${code}`);
      handled.current = false;
      return;
    }
    store.play(place, trigger);
    router.replace(`/place/${code}`);
  };

  const onScan = (data: string) => {
    if (handled.current) return;
    handled.current = true;
    const code = parsePlaceCode(data);
    if (!code) {
      setMessage(t("invalidQr"));
      setTimeout(() => (handled.current = false), 1500);
      return;
    }
    open(code, "qr");
  };

  const press = (k: string) => {
    setMessage(null);
    if (k === "⌫") setDigits((d) => d.slice(0, -1));
    else if (k && digits.length < 3) {
      const next = digits + k;
      setDigits(next);
      if (next.length === 3) open(next, "code");
    }
  };

  const cameraAllowed = perm?.granted;
  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={styles.tabs}>
        {(["camera", "keypad"] as const).map((m) => (
          <Pressable key={m} onPress={() => { setMode(m); setMessage(null); setDigits(""); }} style={[styles.tab, { borderColor: c.primary, backgroundColor: mode === m ? c.primary : "transparent" }]}>
            <Text style={{ color: mode === m ? c.primaryText : c.primary, fontWeight: "700" }}>{m === "camera" ? t("scan") : t("enterCode")}</Text>
          </Pressable>
        ))}
      </View>

      {mode === "camera" ? (
        cameraAllowed ? (
          <View style={styles.cameraBox}>
            <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={(r) => onScan(r.data)} />
            <View style={styles.frame} pointerEvents="none" />
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={{ color: c.muted, textAlign: "center" }}>{t("cameraDenied")}</Text>
            <Button title={t("allowCamera")} onPress={() => void requestPerm()} />
            <Button title={t("enterCode")} variant="ghost" onPress={() => setMode("keypad")} />
          </View>
        )
      ) : (
        <View style={styles.keypadWrap}>
          <Text style={{ color: c.muted }}>{t("codeHint")}</Text>
          <View style={styles.slots}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.slot, { borderColor: digits.length === i ? c.primary : c.border, backgroundColor: c.card }]}>
                <Text style={[styles.slotText, { color: c.text }]}>{digits[i] ?? ""}</Text>
              </View>
            ))}
          </View>
          <View style={styles.keys}>
            {KEYS.map((k, i) => (
              <Pressable key={i} disabled={!k} onPress={() => press(k)} style={({ pressed }) => [styles.key, { backgroundColor: k ? c.card : "transparent", opacity: pressed ? 0.6 : 1 }]}>
                <Text style={[styles.keyText, { color: c.text }]}>{k}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      {message && <Text style={[styles.msg, { color: c.warn }]}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 16 },
  tabs: { flexDirection: "row", gap: 8 },
  tab: { flex: 1, borderWidth: 1.5, borderRadius: 999, paddingVertical: 10, alignItems: "center" },
  cameraBox: { flex: 1, borderRadius: 16, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  frame: { width: 220, height: 220, borderWidth: 3, borderColor: "#fff", borderRadius: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  keypadWrap: { flex: 1, alignItems: "center", gap: 16 },
  slots: { flexDirection: "row", gap: 12 },
  slot: { width: 64, height: 76, borderRadius: 14, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  slotText: { fontSize: 36, fontWeight: "700", fontVariant: ["tabular-nums"] },
  keys: { flexDirection: "row", flexWrap: "wrap", width: 288, gap: 12, justifyContent: "center" },
  key: { width: 84, height: 64, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  keyText: { fontSize: 26, fontWeight: "600" },
  msg: { textAlign: "center", fontSize: 16, fontWeight: "600" },
});
