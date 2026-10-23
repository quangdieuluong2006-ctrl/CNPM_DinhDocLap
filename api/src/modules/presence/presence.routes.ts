import { Router } from "express";
import { z } from "zod";
import { currentUser, requireAuth } from "../../middlewares/auth.js";
import { clientTypeSchema } from "../auth/auth.schemas.js";
import * as repo from "./presence.repository.js";
import { broadcastPresence } from "./presence.service.js";

export const presenceRouter = Router();

const heartbeatSchema = z.object({
  sessionId: z.coerce.number().int().positive().optional(),
  clientType: clientTypeSchema.default("web"),
});

// Nhịp tim dự phòng khi Socket.IO không kết nối được (PRD v1.0, mục 12).
presenceRouter.post("/presence/heartbeat", requireAuth, async (req, res) => {
  const { sub: userId, role } = currentUser(res.locals);
  const input = heartbeatSchema.parse(req.body ?? {});
  const clientType = input.clientType === "admin" && role !== "admin" ? "web" : input.clientType;

  if (input.sessionId && (await repo.touchSession(input.sessionId, userId))) {
    res.json({ sessionId: input.sessionId });
    return;
  }
  const existing = await repo.findOpenRestSession(userId, clientType);
  if (existing && (await repo.touchSession(existing, userId))) {
    res.json({ sessionId: existing });
    return;
  }
  const sessionId = await repo.openSession({ userId, clientType, ip: req.ip, userAgent: req.get("user-agent") });
  await broadcastPresence({ userId, type: "online" });
  res.json({ sessionId });
});
