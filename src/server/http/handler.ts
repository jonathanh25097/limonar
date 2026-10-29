import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { Actor } from "@/core/shared/actor";
import { DomainError, type DomainErrorCode } from "@/core/shared/errors";
import { requireActor } from "../auth/session";

const STATUS: Record<DomainErrorCode, number> = {
  validation: 400,
  unauthenticated: 401,
  forbidden: 403,
  two_person_rule: 403,
  not_found: 404,
  conflict: 409,
  invalid_transition: 409,
  locked: 409,
};

export const ok = <T>(data: T, init?: ResponseInit) => Response.json({ data }, init);

export const fail = (code: string, message: string, status: number, details?: unknown) =>
  Response.json({ error: { code, message, ...(details === undefined ? {} : { details }) } }, { status });

const toResponse = (err: unknown) => {
  // Let Next.js see its own control-flow errors (e.g. "this route is dynamic, stop prerendering").
  unstable_rethrow(err);
  if (err instanceof DomainError) return fail(err.code, err.message, STATUS[err.code], err.details);
  if (err instanceof z.ZodError) {
    return fail("validation", "Some fields are missing or invalid", 400, {
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  // Duplicate key from a unique index.
  if (typeof err === "object" && err && "code" in err && (err as { code: unknown }).code === 11000) {
    return fail("conflict", "That record already exists", 409);
  }
  console.error(err);
  return fail("internal", "Something went wrong", 500);
};

type Ctx<P> = { params: Promise<P> };

/**
 * Wraps a route handler: resolves the caller and turns domain and validation
 * errors into the standard error body. Route files stay a few lines each; the
 * rules live in core/ and server/services/.
 */
export const handler =
  <P = Record<string, never>>(fn: (args: { req: Request; actor: Actor; params: P }) => Promise<Response>) =>
  async (req: Request, ctx: Ctx<P>) => {
    try {
      const actor = await requireActor(req);
      return await fn({ req, actor, params: await ctx.params });
    } catch (err) {
      return toResponse(err);
    }
  };

/** Same as `handler`, for the few endpoints that don't need a session (login, health). */
export const publicHandler = (fn: (args: { req: Request }) => Promise<Response>) => async (req: Request) => {
  try {
    return await fn({ req });
  } catch (err) {
    return toResponse(err);
  }
};

export const parseBody = async <S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new DomainError("validation", "Request body must be JSON");
  }
  return schema.parse(body);
};

export const parseQuery = <S extends z.ZodType>(req: Request, schema: S): z.output<S> =>
  schema.parse(Object.fromEntries(new URL(req.url).searchParams));
