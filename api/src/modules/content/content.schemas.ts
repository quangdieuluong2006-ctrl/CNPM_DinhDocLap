import { z } from "zod";

export const langSchema = z.string().trim().toLowerCase().regex(/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/, "Mã ngôn ngữ ISO 639-1");
export const ZONES = ["outdoor", "ground", "floor1", "floor2", "rooftop", "basement"] as const;
export const placeCodeSchema = z.string().regex(/^[0-9]{3}$/, "Số điểm gồm đúng 3 chữ số");
