import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, Tooltip } from "react-leaflet";
import type { Place } from "../lib/types";

export const PALACE_CENTER: [number, number] = [10.777, 106.6953];

function codeIcon(code: string, highlight: boolean): L.DivIcon {
  const bg = highlight ? "#b8862f" : "#1f5c4a";
  return L.divIcon({
    className: "",
    html: `<div style="background:${bg};color:#fff;font:700 12px system-ui;padding:3px 7px;border-radius:10px;border:2px solid #fff;box-shadow:0 1px 4px #0006">${code}</div>`,
    iconSize: [36, 22],
    iconAnchor: [18, 11],
  });
}

// Gộp các điểm trong nhà (nằm sát nhau trong tòa nhà) thành một marker, giống ứng dụng Mobile.
function buildingIcon(count: number): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="background:#b8862f;color:#fff;font:700 12px system-ui;padding:3px 8px;border-radius:10px;border:2px solid #fff;box-shadow:0 1px 4px #0006;white-space:nowrap">🏛 ${count}</div>`,
    iconSize: [44, 22],
    iconAnchor: [22, 11],
  });
}

// FE-15 Bản đồ khuôn viên: Leaflet + OpenStreetMap (không cần khóa API).
export function CampusMap(props: {
  places: Place[];
  onSelect?: (p: Place) => void;
  onBuilding?: () => void;
  highlightCode?: string;
  me?: { lat: number; lng: number; accuracy: number } | null;
  center?: [number, number];
  zoom?: number;
  height: number | string;
  interactive?: boolean;
}) {
  const outdoor = props.places.filter((p) => p.trigger === "gps");
  const indoor = props.places.filter((p) => p.trigger === "indoor");
  const building: [number, number] | null = indoor.length
    ? [indoor.reduce((s, p) => s + p.lat, 0) / indoor.length, indoor.reduce((s, p) => s + p.lng, 0) / indoor.length]
    : null;
  const interactive = props.interactive ?? true;

  return (
    <div className="overflow-hidden rounded-2xl border shadow-sm" style={{ height: props.height }}>
      <MapContainer
        center={props.center ?? PALACE_CENTER}
        zoom={props.zoom ?? 17}
        maxZoom={20}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
        style={{ height: "100%" }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={20}
          maxNativeZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {outdoor.map((p) => (
          <Circle key={`z${p.id}`} center={[p.lat, p.lng]} radius={p.radiusM} pathOptions={{ color: "#1f5c4a", weight: 1.5, fillOpacity: 0.12 }} />
        ))}
        {outdoor.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={codeIcon(p.code, p.code === props.highlightCode)} eventHandlers={{ click: () => props.onSelect?.(p) }}>
            <Tooltip direction="top" offset={[0, -10]}>{p.content?.title ?? p.code}</Tooltip>
          </Marker>
        ))}
        {building && (
          <Marker position={building} icon={buildingIcon(indoor.length)} eventHandlers={{ click: () => props.onBuilding?.() }} />
        )}
        {props.me && (
          <>
            <Circle center={[props.me.lat, props.me.lng]} radius={props.me.accuracy} pathOptions={{ color: "#2563eb", weight: 1, fillOpacity: 0.1 }} />
            <CircleMarker center={[props.me.lat, props.me.lng]} radius={7} pathOptions={{ color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }} />
          </>
        )}
      </MapContainer>
    </div>
  );
}
