import { useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";
import { PALACE_CENTER } from "../services/config";
import { useColors } from "../theme";
import { indoorCluster, type PlaceMapProps } from "./PlaceMap.types";

// Bản đồ khuôn viên (PRD v1.0, FE-03): marker số điểm theo trạng thái, vòng tròn vùng kích hoạt điểm GPS,
// chấm vị trí khách kèm vòng sai số. Tọa độ khách không bao giờ gửi lên máy chủ.
export function PlaceMap(props: PlaceMapProps) {
  const c = useColors();
  const map = useRef<MapView>(null);

  useEffect(() => {
    if (props.recenterKey && props.fix) {
      map.current?.animateToRegion({ latitude: props.fix.lat, longitude: props.fix.lng, latitudeDelta: 0.003, longitudeDelta: 0.003 }, 400);
    }
  }, [props.recenterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const building = indoorCluster(props.places);
  const colorOf = (id: number) =>
    id === props.playingId ? c.markerPlaying : props.completed.includes(id) ? c.markerDone : c.marker;

  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      initialRegion={{ latitude: PALACE_CENTER.lat, longitude: PALACE_CENTER.lng, latitudeDelta: 0.0045, longitudeDelta: 0.0045 }}
      onPress={(e) => props.onMapPress?.({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
      toolbarEnabled={false}
    >
      {props.places
        .filter((p) => p.trigger === "gps")
        .map((p) => (
          <Circle
            key={`zone-${p.id}`}
            center={{ latitude: p.lat, longitude: p.lng }}
            radius={p.radiusM}
            strokeColor={colorOf(p.id)}
            fillColor={`${colorOf(p.id)}22`}
          />
        ))}
      {building && (
        <Marker
          key={`building-${building.count}`}
          coordinate={{ latitude: building.lat, longitude: building.lng }}
          onPress={() => props.onSelectBuilding?.()}
          tracksViewChanges={false}
        >
          <View style={[styles.building, { backgroundColor: c.accent }]}>
            <Ionicons name="business" size={14} color="#fff" />
            <Text style={styles.markerText}>{building.count}</Text>
          </View>
        </Marker>
      )}
      {props.places.filter((p) => p.trigger === "gps").map((p) => (
        <Marker
          key={`m-${p.id}-${colorOf(p.id)}`}
          coordinate={{ latitude: p.lat, longitude: p.lng }}
          onPress={() => props.onSelect(p)}
          tracksViewChanges={false}
        >
          <View style={[styles.marker, { backgroundColor: colorOf(p.id), borderWidth: props.selectedId === p.id ? 3 : 1.5 }]}>
            <Text style={styles.markerText}>{p.code}</Text>
          </View>
        </Marker>
      ))}
      {props.fix && (
        <>
          <Circle
            center={{ latitude: props.fix.lat, longitude: props.fix.lng }}
            radius={props.fix.accuracy}
            strokeColor="#2563EB55"
            fillColor="#2563EB1A"
          />
          <Marker coordinate={{ latitude: props.fix.lat, longitude: props.fix.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={styles.me} />
          </Marker>
        </>
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  marker: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10, borderColor: "#fff" },
  markerText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  building: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1.5, borderColor: "#fff" },
  me: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#2563EB", borderWidth: 3, borderColor: "#fff" },
});
