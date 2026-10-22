import { Router } from "express";
import { currentUser, requireAuth } from "../../middlewares/auth.js";
import { getMe } from "../auth/auth.service.js";

export const meRouter = Router();

meRouter.get("/me", requireAuth, async (_req, res) => {
  res.json(await getMe(currentUser(res.locals).sub));
});
