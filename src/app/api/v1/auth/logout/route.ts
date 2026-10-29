import { clearSessionCookie } from "@/server/auth/session";
import { ok, publicHandler } from "@/server/http/handler";

export const POST = publicHandler(async () => ok(null, { headers: { "Set-Cookie": clearSessionCookie() } }));
