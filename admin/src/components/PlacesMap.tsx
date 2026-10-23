import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMapEvents } from "react-leaflet";
import type { AdminPlace } from "../lib/types";

export const PALACE_CENTER: [number, number] = [10.777, 106.6953];

const STATUS_COLOR: Record<string, string> = { published: "#047857", draft: "#b45309", hidden: "#94a3b8" };

function codeIcon(code: string, color: string, selected: boolean): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:#fff;font:600 12px system-ui;padding:2px 6px;border-radius:9px;border:${selected ? 3 : 1.5}px solid #fff;box-shadow:0 1px 3px #0005;white-space:nowrap">${code}</div>`,
    iconSize: [34, 20],
    iconAnchor: [17, 10],
  });
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))) });
  return null;
}

// Bản đồ OpenStreetMap (Leaflet) cho Web Admin: marker số điểm, vòng tròn vùng kích hoạt điểm GPS.
// Chế độ chỉnh sửa: bấm lên bản đồ để đặt tọa độ cho điểm đang sửa (PRD v1.0, FE-20).
export function PlacesMap(props: {
  places: AdminPlace[];
  selectedId?: number | null;
  onSelect?: (p: AdminPlace) => void;
  editing?: { lat: number; lng: number; radiusM: number; trigger: "gps" | "indoor"; code: string } | null;
  onPick?: (lat: number, lng: number) => void;
  height?: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border shadow-sm" style={{ height: props.height ?? 420 }}>
      <MapContainer center={props.editing ? [props.editing.lat, props.editing.lng] : PALACE_CENTER} zoom={18} maxZoom={20} style={{ height: "100%" }}>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={20}
          maxNativeZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {props.onPick && <ClickHandler onClick={props.onPick} />}
        {props.places.map((p) => {
          const color = STATUS_COLOR[p.status] ?? "#047857";
          return (
            <div key={p.id}>
              {p.trigger === "gps" && (
                <Circle center={[p.lat, p.lng]} radius={p.radiusM} pathOptions={{ color, weight: 1.5, fillOpacity: 0.12 }} />
              )}
              <Marker
                position={[p.lat, p.lng]}
                icon={codeIcon(p.code, color, props.selectedId === p.id)}
                eventHandlers={{ click: () => props.onSelect?.(p) }}
              >
                <Tooltip direction="top" offset={[0, -10]}>{p.internalName}</Tooltip>
              </Marker>
            </div>
          );
        })}
        {props.editing && (
          <>
            {props.editing.trigger === "gps" && (
              <Circle center={[props.editing.lat, props.editing.lng]} radius={props.editing.radiusM} pathOptions={{ color: "#dc2626", weight: 2, dashArray: "6 4", fillOpacity: 0.15 }} />
            )}
            <Marker position={[props.editing.lat, props.editing.lng]} icon={codeIcon(props.editing.code || "mới", "#dc2626", true)} />
          </>
        )}
      </MapContainer>
    </div>
  );
}
