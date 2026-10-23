import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "../theme";
import { indoorCluster, type PlaceMapProps } from "./PlaceMap.types";

// Bản xem trên trình duyệt (react-native-maps không chạy trên web): sơ đồ phẳng chiếu kinh/vĩ độ lên khung,
// đủ để xem trước giao diện và thử chế độ mô phỏng bằng cách chạm.
const BOUNDS = { minLat: 10.7758, maxLat: 10.7790, minLng: 106.6940, maxLng: 106.6975 };

export function PlaceMap(props: PlaceMapProps) {
  const c = useColors();
  const pos = (lat: number, lng: number) => ({
    left: `${((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100}%` as const,
    top: `${((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100}%` as const,
  });
  const building = indoorCluster(props.places);
  const colorOf = (id: number) =>
    id === props.playingId ? c.markerPlaying : props.completed.includes(id) ? c.markerDone : c.marker;
  return (
    <Pressable
      style={[StyleSheet.absoluteFill, { backgroundColor: "#DCE8D5" }]}
      onPress={(e) => {
        const { locationX, locationY } = e.nativeEvent;
        const target = e.currentTarget as unknown as { getBoundingClientRect?: () => { width: number; height: number } };
        const rect = target.getBoundingClientRect?.();
        if (!rect || !props.onMapPress) return;
        props.onMapPress({
          lat: BOUNDS.maxLat - (locationY / rect.height) * (BOUNDS.maxLat - BOUNDS.minLat),
          lng: BOUNDS.minLng + (locationX / rect.width) * (BOUNDS.maxLng - BOUNDS.minLng),
        });
      }}
    >
      <View style={[styles.building, pos(10.77725, 106.69505)]} />
      {building && (
        <Pressable onPress={() => props.onSelectBuilding?.()} style={[styles.markerWrap, pos(building.lat, building.lng)]}>
          <View style={[styles.marker, { backgroundColor: c.accent, borderWidth: 1.5 }]}>
            <Text style={styles.markerText}>🏛 {building.count}</Text>
          </View>
        </Pressable>
      )}
      {props.places.filter((p) => p.trigger === "gps").map((p) => (
        <Pressable key={p.id} onPress={() => props.onSelect(p)} style={[styles.markerWrap, pos(p.lat, p.lng)]}>
          <View style={[styles.marker, { backgroundColor: colorOf(p.id), borderWidth: props.selectedId === p.id ? 3 : 1.5 }]}>
            <Text style={styles.markerText}>{p.code}</Text>
          </View>
        </Pressable>
      ))}
      {props.fix && <View pointerEvents="none" style={[styles.me, pos(props.fix.lat, props.fix.lng)]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  building: { position: "absolute", width: "26%", height: "14%", marginLeft: "-13%", marginTop: "-7%", backgroundColor: "#C9C3B2", borderRadius: 6 },
  markerWrap: { position: "absolute", transform: [{ translateX: -18 }, { translateY: -12 }] },
  marker: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10, borderColor: "#fff" },
  markerText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  me: { position: "absolute", width: 16, height: 16, marginLeft: -8, marginTop: -8, borderRadius: 8, backgroundColor: "#2563EB", borderWidth: 3, borderColor: "#fff" },
});
