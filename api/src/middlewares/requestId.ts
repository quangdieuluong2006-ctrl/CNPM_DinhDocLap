import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

// Mỗi request có một mã để đối chiếu giữa log máy chủ và lỗi phía client.
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header("x-request-id");
  const id = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  res.locals.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
};
