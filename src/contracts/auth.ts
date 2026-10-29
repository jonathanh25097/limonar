import { z } from "zod";
import { ROLES } from "@/core/auth/roles";
import { Id } from "./common";

export const LoginRequest = z
  .object({
    phone: z.string().trim().min(4).max(20),
    pin: z.string().regex(/^\d{4,8}$/, "PIN must be 4 to 8 digits"),
  })
  .meta({ id: "LoginRequest" });
export type LoginRequest = z.infer<typeof LoginRequest>;

export const SessionUser = z
  .object({
    id: Id,
    name: z.string(),
    phone: z.string(),
    roles: z.array(z.enum(ROLES)),
    permissions: z.array(z.string()),
  })
  .meta({ id: "SessionUser" });
export type SessionUser = z.infer<typeof SessionUser>;

export const LoginResponse = z
  .object({
    token: z.string().describe("Bearer token for non-browser clients; browsers also get an httpOnly cookie"),
    expiresAt: z.string(),
    user: SessionUser,
  })
  .meta({ id: "LoginResponse" });
export type LoginResponse = z.infer<typeof LoginResponse>;
