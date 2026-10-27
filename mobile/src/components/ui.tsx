import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { placePhoto, zoneStyle } from "../photos";
import type { Place } from "../services/api";
import { store } from "../state/store";
import { useColors } from "../theme";

// Hiệu ứng động dùng Animated có sẵn của React Native (không thêm thư viện). Trên web không có native driver.
const native = Platform.OS !== "web";

// Hiện dần + trượt nhẹ lên khi xuất hiện; delay để các thẻ trong danh sách hiện lần lượt
export function FadeIn(props: { children: ReactNode; delay?: number; style?: ViewStyle }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, delay: props.delay ?? 0, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [v, props.delay]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  return <Animated.View style={[props.style, { opacity: v, transform: [{ translateY }] }]}>{props.children}</Animated.View>;
}

// Ô màu theo khu vực (điểm chưa có ảnh)
export function ZoneTile(props: { zone: string; size?: number; style?: ViewStyle; iconSize?: number }) {
  const { icon, bg } = zoneStyle(props.zone);
  return (
    <View style={[styles.tile, { backgroundColor: bg }, props.size ? { width: props.size, height: props.size } : null, props.style]}>
      <View style={styles.tileDeco} />
      <Ionicons name={icon} size={props.iconSize ?? 24} color="#fff" />
    </View>
  );
}

// Ảnh nhỏ của điểm (ảnh tải lên → ảnh có sẵn → ô màu khu vực) kèm số điểm ở góc
export function PlaceThumb(props: { place: Pick<Place, "code" | "imageUrl" | "zone">; size?: number; dim?: boolean }) {
  const size = props.size ?? 56;
  const photo = placePhoto(props.place, (u) => store.api.mediaUrl(u));
  return (
    <View style={{ width: size, height: size, borderRadius: 12, overflow: "hidden", opacity: props.dim ? 0.55 : 1 }}>
      {photo ? <Image source={photo.source} style={{ width: size, height: size }} /> : <ZoneTile zone={props.place.zone} size={size} />}
      <View style={styles.thumbCode}>
        <Text style={styles.thumbCodeText}>{props.place.code}</Text>
      </View>
    </View>
  );
}

// Sóng âm 5 cột nhảy theo nhịp khi đang phát; đứng yên (thấp, mờ) khi tạm dừng
export function Equalizer(props: { active: boolean; color: string; height?: number }) {
  const h = props.height ?? 18;
  const bars = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    if (!props.active) {
      bars.forEach((b) => b.setValue(0.3));
      return;
    }
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 1, duration: 380 + i * 60, delay: i * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
          Animated.timing(b, { toValue: 0.25, duration: 380 + i * 60, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [props.active, bars]);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: h }}>
      {bars.map((b, i) => (
        <Animated.View
          key={i}
          style={{ width: 4, height: h, borderRadius: 2, backgroundColor: props.color, opacity: props.active ? 1 : 0.4, transformOrigin: "bottom", transform: [{ scaleY: b }] }}
        />
      ))}
    </View>
  );
}

// Vòng sáng lan tỏa quanh nút phát khi đang phát
export function PulseRing(props: { active: boolean; size: number; color: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!props.active) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: native }));
    loop.start();
    return () => {
      loop.stop();
      v.setValue(0);
    };
  }, [props.active, v]);
  if (!props.active) return null;
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: "absolute", width: props.size, height: props.size, borderRadius: props.size / 2, backgroundColor: props.color, opacity, transform: [{ scale }] }}
    />
  );
}

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
  tile: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  tileDeco: { position: "absolute", right: "-15%", top: "-25%", width: "60%", aspectRatio: 1, borderRadius: 999, backgroundColor: "#ffffff26" },
  thumbCode: { position: "absolute", left: 4, bottom: 4, backgroundColor: "#000000a0", borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 },
  thumbCodeText: { color: "#fff", fontSize: 10, fontWeight: "800", fontVariant: ["tabular-nums"] },
});
