import type { Role } from "../auth/roles";

/** Whoever is performing an action: a signed-in person, or the system itself. */
export interface Actor {
  userId: string;
  name: string;
  roles: Role[];
}

export const SYSTEM_ACTOR: Actor = { userId: "system", name: "Sistema", roles: [] };
