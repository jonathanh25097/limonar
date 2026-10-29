import type { Actor } from "../shared/actor";
import { DomainError } from "../shared/errors";

/**
 * Six roles cover everyone. One person can hold several (Ivania as office and
 * seller); the two-person rule still applies on top of the role check.
 */
export const ROLES = ["owner", "office", "field", "seller", "buyer", "agent"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Dueño",
  office: "Oficina",
  field: "Campo",
  seller: "Vendedor",
  buyer: "Comprador",
  agent: "Consignataria",
};

/**
 * Permission matrix from the spec. "Own" scoping (a buyer only sees their own
 * requests, an agent only her own stock) is enforced by the service, which
 * knows what the document belongs to.
 */
export const PERMISSIONS = {
  "catalog.manage": ["owner"],
  "catalog.propose": ["owner", "office"],
  "catalog.read": ["owner", "office", "field", "seller", "buyer", "agent"],
  "customers.read": ["owner", "office", "field", "seller"],
  "orders.create": ["owner", "office", "seller", "buyer"],
  "orders.read.all": ["owner", "office", "field", "seller"],
  "orders.approve": ["owner"],
  "orders.cancel": ["owner"],
  "deliveries.record": ["field"],
  "deliveries.count": ["office", "field", "buyer"],
  "payments.upload": ["field", "seller", "buyer"],
  "payments.verify": ["owner", "office"],
  "consignment.report": ["office", "field", "agent"],
  "expenses.record": ["owner", "office", "field"],
  "expenses.approve": ["owner"],
  "payroll.prepare": ["office"],
  "payroll.attendance": ["field"],
  "payroll.approve": ["owner"],
  "payroll.uploadProof": ["office", "field"],
  "periods.close": ["owner"],
  "users.manage": ["owner"],
  "audit.read": ["owner", "office"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export const can = (actor: Pick<Actor, "roles">, permission: Permission): boolean =>
  actor.roles.some((r) => (PERMISSIONS[permission] as readonly Role[]).includes(r));

export const assertCan = (actor: Pick<Actor, "roles">, permission: Permission) => {
  if (!can(actor, permission)) {
    throw new DomainError("forbidden", `Your role doesn't allow ${permission}`);
  }
};

export const permissionsFor = (roles: Role[]): Permission[] =>
  (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can({ roles }, p));
