import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useColors } from "../theme";

export function Button(props: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "ghost";
  icon?: ReactNode;
  style?: ViewStyle;
  textColor?: string;
  disabled?: boolean;
}) {
  const c = useColors();
  const primary = (props.variant ?? "primary") === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: primary ? c.primary : "transparent", borderColor: c.primary, opacity: props.disabled ? 0.5 : pressed ? 0.8 : 1 },
        props.style,
      ]}
    >
      {props.icon}
      <Text style={[styles.btnText, { color: props.textColor ?? (primary ? c.primaryText : c.primary) }]}>{props.title}</Text>
    </Pressable>
  );
}

export function Pill(props: { text: string; tone: "warn" | "info" | "done" }) {
  const c = useColors();
  const map = { warn: [c.warnBg, c.warn], info: [c.infoBg, c.info], done: [c.infoBg, c.done] } as const;
  const [bg, fg] = map[props.tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{props.text}</Text>
    </View>
  );
}

// Biển số điểm: hình tròn chứa 3 chữ số, giống biển in tại từng phòng.
export function CodeBadge(props: { code: string; color?: string; size?: number }) {
  const c = useColors();
  const size = props.size ?? 40;
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: props.color ?? c.primary }]}>
      <Text style={[styles.badgeText, { fontSize: size * 0.32 }]}>{props.code}</Text>
    </View>
  );
}

export function Banner(props: { text: string; tone: "warn" | "info"; action?: { title: string; onPress: () => void } }) {
  const c = useColors();
  const bg = props.tone === "warn" ? c.warnBg : c.infoBg;
  const fg = props.tone === "warn" ? c.warn : c.info;
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Text style={[styles.bannerText, { color: fg }]}>{props.text}</Text>
      {props.action && (
        <Pressable onPress={props.action.onPress} hitSlop={8}>
          <Text style={[styles.bannerAction, { color: fg }]}>{props.action.title}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1.5 },
  btnText: { fontSize: 16, fontWeight: "600" },
  pill: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: "600" },
  badge: { alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontWeight: "700", fontVariant: ["tabular-nums"] },
  banner: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  bannerText: { flex: 1, fontSize: 13, fontWeight: "500" },
  bannerAction: { fontSize: 13, fontWeight: "700" },
});
