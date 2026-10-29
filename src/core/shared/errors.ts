/**
 * Errors raised by business rules. The HTTP layer maps each code to a status,
 * so the core never needs to know about HTTP.
 */
export type DomainErrorCode =
  | "validation" // input is malformed or incomplete
  | "unauthenticated" // no valid session
  | "forbidden" // the actor's roles don't allow this
  | "not_found"
  | "conflict" // state changed underneath us, or a uniqueness rule
  | "invalid_transition" // the document's status doesn't allow this action
  | "two_person_rule" // the actor recorded this and can't approve/verify it
  | "locked"; // the record is approved/closed and can't be edited

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const isDomainError = (e: unknown): e is DomainError => e instanceof DomainError;
