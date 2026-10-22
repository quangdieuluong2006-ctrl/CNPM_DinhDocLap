import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../../lib/apiError.js";
import { currentUser, requireAuth } from "../../middlewares/auth.js";
import { updateProfile } from "../auth/auth.repository.js";
import { getMe } from "../auth/auth.service.js";
import { langSchema } from "../content/content.schemas.js";

export const meRouter = Router();

meRouter.get("/me", requireAuth, async (_req, res) => {
  res.json(await getMe(currentUser(res.locals).sub));
});

const patchSchema = z
  .object({
    fullName: z.string().trim().min(1).max(100).optional(),
    uiLocale: z.enum(["vi", "en"]).optional(),
    narrationLang: langSchema.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, "Cần ít nhất một trường để cập nhật");

// Đổi tên, ngôn ngữ giao diện, ngôn ngữ thuyết minh mặc định (PRD v1.0, mục 11.2).
meRouter.patch("/me", requireAuth, async (req, res) => {
  const { sub } = currentUser(res.locals);
  await getMe(sub); // chặn tài khoản đã bị khóa
  const input = patchSchema.parse(req.body);
  if (!(await updateProfile(sub, input))) {
    throw new ApiError(400, "VALIDATION_ERROR", "Ngôn ngữ thuyết minh không tồn tại hoặc đang tắt", {
      fields: [{ path: ["narrationLang"], message: "Ngôn ngữ không khả dụng" }],
    });
  }
  res.json(await getMe(sub));
});
