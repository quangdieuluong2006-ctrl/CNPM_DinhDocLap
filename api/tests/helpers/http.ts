import type { Express } from "express";
import request from "supertest";
import { expect } from "vitest";

export const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "Demo@12345";

export async function loginAs(app: Express, email: string, clientType: "web" | "admin" | "mobile" = "mobile"): Promise<string> {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password: SEED_PASSWORD, clientType });
  expect(res.status).toBe(200);
  return res.body.accessToken as string;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
