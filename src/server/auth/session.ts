import { jwtVerify, SignJWT } from "jose";
import type { Actor } from "@/core/shared/actor";
import { DomainError } from "@/core/shared/errors";
import { collections } from "../db/collections";
import { getDb } from "../db/mongo";
import { env } from "../env";

/**
 * Sessions are signed tokens. Browsers get one in an httpOnly cookie; other
 * clients (a phone app, an integration) send it as `Authorization: Bearer`.
 * The API accepts either, so every client talks to the same endpoints.
 */
export const SESSION_COOKIE = "limonar_session";

const key = () => new TextEncoder().encode(env().authSecret);

export const issueToken = async (userId: string) => {
  const expiresAt = new Date(Date.now() + env().sessionDays * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(key());
  return { token, expiresAt };
};

const readToken = (req: Request): string | undefined => {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  const cookie = req.headers.get("cookie");
  return cookie
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
};

/**
 * Resolves who is calling. Roles are read from the database on every request,
 * so removing a role or deactivating someone takes effect immediately.
 */
export const requireActor = async (req: Request): Promise<Actor> => {
  const token = readToken(req);
  if (!token) throw new DomainError("unauthenticated", "Sign in first");
  let userId: string | undefined;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    userId = payload.sub;
  } catch {
    throw new DomainError("unauthenticated", "Your session has expired, sign in again");
  }
  const user = userId ? await collections(await getDb()).users.findOne({ _id: userId, active: true }) : null;
  if (!user) throw new DomainError("unauthenticated", "Sign in first");
  return { userId: user._id, name: user.name, roles: user.roles };
};

export const sessionCookie = (token: string, expiresAt: Date) =>
  `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;

export const clearSessionCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
