import { z } from "zod";
import { CURRENCIES } from "@/core/shared/money";
import { DIVISION_IDS } from "@/core/divisions";

/**
 * The API contract. Every route validates its input with these schemas and
 * every client (this web app, a future mobile app, an integration) can import
 * the same types or read them from /api/v1/openapi.json.
 *
 * Conventions:
 * - Success: `{ "data": ... }`. Errors: `{ "error": { "code", "message", "details" } }`.
 * - Money: integer minor units plus currency, `{ "amount": 180000, "currency": "NIO" }` = C$ 1,800.00.
 * - Dates: ISO 8601 strings.
 * - Ids: opaque strings.
 */

export const Id = z.string().min(1).max(64).describe("Opaque id");
export const DivisionIdSchema = z.enum(DIVISION_IDS);
export const CurrencySchema = z.enum(CURRENCIES);

export const MoneySchema = z
  .object({
    amount: z.number().int().describe("Minor units (centavos / cents)"),
    currency: CurrencySchema,
  })
  .meta({ id: "Money" });

export const IsoDate = z.iso.datetime({ offset: true });

export const StatusChangeSchema = z.object({
  from: z.string().nullable(),
  to: z.string(),
  by: Id,
  byName: z.string(),
  at: IsoDate,
  note: z.string().optional(),
});

export const ApiErrorSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .meta({ id: "ApiError" });
export type ApiError = z.infer<typeof ApiErrorSchema>["error"];

export const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
