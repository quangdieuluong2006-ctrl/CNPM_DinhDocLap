import { Building2, DoorOpen, Landmark, ShieldHalf, Sun, Trees, type LucideIcon } from "lucide-react";

// Màu và biểu tượng riêng cho từng khu vực: dùng làm ảnh thay thế khi điểm chưa có ảnh (thẻ điểm, đầu trang chi tiết).
const ZONE_STYLE: Record<string, { icon: LucideIcon; bg: string }> = {
  outdoor: { icon: Trees, bg: "from-emerald-500 to-brand-700" },
  ground: { icon: DoorOpen, bg: "from-amber-400 to-gold-600" },
  floor1: { icon: Landmark, bg: "from-sky-500 to-sky-800" },
  floor2: { icon: Building2, bg: "from-indigo-400 to-indigo-700" },
  rooftop: { icon: Sun, bg: "from-orange-400 to-rose-600" },
  basement: { icon: ShieldHalf, bg: "from-stone-500 to-stone-800" },
};

export function zoneStyle(zone: string) {
  return ZONE_STYLE[zone] ?? ZONE_STYLE.outdoor!;
}

export function ZoneThumb(props: { zone: string; className?: string; iconSize?: number }) {
  const { icon: Icon, bg } = zoneStyle(props.zone);
  return (
    <span className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br text-white ${bg} ${props.className ?? ""}`}>
      <span className="absolute -right-[12%] -top-[20%] aspect-square w-1/2 rounded-full bg-white/15" />
      <Icon size={props.iconSize ?? 28} className="relative drop-shadow" />
    </span>
  );
}
