import { permissionsFor } from "@/core/auth/roles";
import type { Actor } from "@/core/shared/actor";
import { DomainError } from "@/core/shared/errors";
import type { LoginRequest, LoginResponse, SessionUser } from "@/contracts/auth";
import { verifyPin } from "../auth/password";
import { issueToken } from "../auth/session";
import { collections, type UserDoc } from "../db/collections";
import { getDb } from "../db/mongo";

const toSessionUser = (u: UserDoc): SessionUser => ({
  id: u._id,
  name: u.name,
  phone: u.phone,
  roles: u.roles,
  permissions: permissionsFor(u.roles),
});

export const login = async ({ phone, pin }: LoginRequest): Promise<LoginResponse> => {
  const user = await collections(await getDb()).users.findOne({ phone: normalizePhone(phone), active: true });
  // Same message either way, so the endpoint doesn't reveal which phones exist.
  if (!user || !(await verifyPin(pin, user.pinHash))) {
    throw new DomainError("unauthenticated", "Phone or PIN is wrong");
  }
  const { token, expiresAt } = await issueToken(user._id);
  return { token, expiresAt: expiresAt.toISOString(), user: toSessionUser(user) };
};

export const me = async (actor: Actor): Promise<SessionUser> => {
  const user = await collections(await getDb()).users.findOne({ _id: actor.userId });
  if (!user) throw new DomainError("unauthenticated", "Sign in first");
  return toSessionUser(user);
};

/** Keeps digits only, so "+505 8888-1234" and "50588881234" match. */
export const normalizePhone = (phone: string) => phone.replace(/\D/g, "");
