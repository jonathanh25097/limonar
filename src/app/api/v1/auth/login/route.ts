import { LoginRequest } from "@/contracts/auth";
import { sessionCookie } from "@/server/auth/session";
import { ok, publicHandler, parseBody } from "@/server/http/handler";
import { login } from "@/server/services/auth";

export const POST = publicHandler(async ({ req }) => {
  const result = await login(await parseBody(req, LoginRequest));
  return ok(result, { headers: { "Set-Cookie": sessionCookie(result.token, new Date(result.expiresAt)) } });
});
