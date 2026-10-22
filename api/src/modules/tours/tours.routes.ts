import { Router } from "express";
import { z } from "zod";
import { currentUser, requireAuth, requireRole } from "../../middlewares/auth.js";
import * as repo from "./tours.repository.js";
import * as service from "./tours.service.js";

// Nhóm tham quan (PRD v1.0, FE-10, mục 4.7). Mọi route cần đăng nhập.
export const toursRouter = Router();

const codeParam = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/, "Mã nhóm gồm 6 ký tự");
const idParam = z.coerce.number().int().positive();

toursRouter.post("/tours", requireAuth, requireRole("guide", "admin"), async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(1).max(100),
    maxMembers: z.number().int().min(2).max(200).default(50),
  }).parse(req.body);
  res.status(201).json(await service.createTour(currentUser(res.locals).sub, body.name, body.maxMembers, req.ip));
});

// Nhóm hiện tại của người đang đăng nhập (để ứng dụng khôi phục màn hình nhóm khi mở lại).
toursRouter.get("/me/tour", requireAuth, async (_req, res) => {
  const m = await repo.activeMembership(currentUser(res.locals).sub);
  res.json({ tour: m ? service.toTourDto((await repo.findTour({ id: m.tour_id }))!) : null });
});

toursRouter.get("/tours/:code", requireAuth, async (req, res) => {
  res.json(service.toTourDto(await service.getTourOr404({ code: codeParam.parse(req.params.code) })));
});

toursRouter.post("/tours/:code/join", requireAuth, async (req, res) => {
  const out = await service.joinTour(codeParam.parse(req.params.code), currentUser(res.locals).sub);
  res.status(out.result === "joined" ? 201 : 200).json(out);
});

toursRouter.post("/tours/:id/leave", requireAuth, async (req, res) => {
  await service.leaveTour(idParam.parse(req.params.id), currentUser(res.locals).sub);
  res.status(204).end();
});

toursRouter.get("/tours/:id/members", requireAuth, async (req, res) => {
  res.json(await service.membersFor(idParam.parse(req.params.id), currentUser(res.locals)));
});

toursRouter.post("/tours/:id/end", requireAuth, async (req, res) => {
  await service.endTour(idParam.parse(req.params.id), currentUser(res.locals), req.ip);
  res.status(204).end();
});
