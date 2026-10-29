import type { Actor } from "./actor";
import { DomainError } from "./errors";

/**
 * Every document that moves fruit or money follows the same shape: someone
 * records it, someone else approves or verifies it, and from then on it can
 * only be reversed, never edited. These helpers encode the parts shared by
 * orders, deliveries, payments, payroll runs and expenses.
 */

export interface StatusChange<S extends string> {
  from: S | null;
  to: S;
  by: string; // userId
  byName: string;
  at: Date;
  note?: string;
}

export interface Recorded<S extends string> {
  status: S;
  statusHistory: StatusChange<S>[];
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
  /** Incremented on every write; used for optimistic concurrency. */
  version: number;
}

export type TransitionTable<S extends string, A extends string> = Record<A, { from: readonly S[]; to: S }>;

/** Returns the target status for `action`, or throws if the current status doesn't allow it. */
export const nextStatus = <S extends string, A extends string>(
  table: TransitionTable<S, A>,
  current: S,
  action: A,
): S => {
  const rule = table[action];
  if (!rule.from.includes(current)) {
    throw new DomainError("invalid_transition", `Cannot ${action} a document that is ${current}`, {
      action,
      status: current,
    });
  }
  return rule.to;
};

export const statusChange = <S extends string>(
  from: S | null,
  to: S,
  actor: Actor,
  at: Date,
  note?: string,
): StatusChange<S> => ({ from, to, by: actor.userId, byName: actor.name, at, ...(note ? { note } : {}) });

/**
 * Two people per money decision: whoever recorded a document can never be the
 * one who approves or verifies it — even if they hold the owner role.
 */
export const assertNotCreator = (doc: { createdBy: string }, actor: Actor, what = "approve") => {
  if (doc.createdBy === actor.userId) {
    throw new DomainError("two_person_rule", `You recorded this, so someone else has to ${what} it`);
  }
};
