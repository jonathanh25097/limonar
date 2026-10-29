import { z } from "zod";
import { UNITS } from "@/core/catalog/product";
import { ORDER_SOURCES, ORDER_STATUSES } from "@/core/sales/order";
import { CurrencySchema, DivisionIdSchema, Id, IsoDate, MoneySchema, StatusChangeSchema } from "./common";

const OrderLineInput = z.object({
  productId: Id,
  quantity: z.number().positive(),
  unitPrice: MoneySchema.nullable().default(null),
});

export const CreateOrderRequest = z
  .object({
    divisionId: DivisionIdSchema.default("lemons"),
    customerId: Id,
    currency: CurrencySchema.default("NIO"),
    lines: z.array(OrderLineInput).min(1),
    neededBy: IsoDate,
    deliveryPoint: z.string().trim().min(1).max(120),
    note: z.string().trim().max(500).optional(),
    replacesOrderId: Id.optional(),
    /** true → straight to pending approval instead of saving a draft. */
    submit: z.boolean().default(false),
  })
  .meta({ id: "CreateOrderRequest" });
export type CreateOrderRequest = z.input<typeof CreateOrderRequest>;

export const UpdateOrderRequest = z
  .object({
    expectedVersion: z.number().int(),
    customerId: Id.optional(),
    lines: z.array(OrderLineInput).min(1).optional(),
    neededBy: IsoDate.optional(),
    deliveryPoint: z.string().trim().min(1).max(120).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .meta({ id: "UpdateOrderRequest" });
export type UpdateOrderRequest = z.input<typeof UpdateOrderRequest>;

export const OrderActionRequest = z
  .discriminatedUnion("action", [
    z.object({ action: z.literal("submit"), expectedVersion: z.number().int() }),
    z.object({ action: z.literal("return"), expectedVersion: z.number().int(), note: z.string().trim().min(1) }),
    z.object({
      action: z.literal("approve"),
      expectedVersion: z.number().int(),
      source: z.enum(ORDER_SOURCES),
      /** Prices for lines drafted without one, keyed by line index. */
      prices: z.record(z.string().regex(/^\d+$/), MoneySchema).optional(),
      note: z.string().trim().optional(),
    }),
    z.object({ action: z.literal("reject"), expectedVersion: z.number().int(), note: z.string().trim().min(1) }),
    z.object({ action: z.literal("cancel"), expectedVersion: z.number().int(), note: z.string().trim().min(1) }),
  ])
  .meta({ id: "OrderActionRequest" });
export type OrderActionRequest = z.input<typeof OrderActionRequest>;

export const OrderLineDTO = z.object({
  productId: Id,
  productName: z.string(),
  unit: z.enum(UNITS),
  quantity: z.number(),
  unitPrice: MoneySchema.nullable(),
  total: MoneySchema.nullable(),
});

export const OrderDTO = z
  .object({
    id: Id,
    divisionId: DivisionIdSchema,
    number: z.string(),
    status: z.enum(ORDER_STATUSES),
    customerId: Id,
    customerName: z.string(),
    currency: CurrencySchema,
    lines: z.array(OrderLineDTO),
    total: MoneySchema.nullable().describe("null while any line has no price"),
    neededBy: IsoDate,
    deliveryPoint: z.string(),
    note: z.string().optional(),
    source: z.enum(ORDER_SOURCES).optional(),
    approvedBy: Id.optional(),
    approvedByName: z.string().optional(),
    approvedAt: IsoDate.optional(),
    rejectReason: z.string().optional(),
    cancelReason: z.string().optional(),
    replacesOrderId: Id.optional(),
    createdBy: Id,
    createdByName: z.string(),
    createdAt: IsoDate,
    updatedAt: IsoDate,
    version: z.number().int(),
    statusHistory: z.array(StatusChangeSchema),
    /** What the current user may do next; clients use it to show buttons. */
    allowedActions: z.array(z.enum(["edit", "submit", "return", "approve", "reject", "cancel"])),
  })
  .meta({ id: "Order" });
export type OrderDTO = z.infer<typeof OrderDTO>;

export const ListOrdersQuery = z.object({
  division: DivisionIdSchema.optional(),
  status: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",") : undefined))
    .pipe(z.array(z.enum(ORDER_STATUSES)).optional()),
  customerId: Id.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const SuggestedPriceQuery = z.object({ customerId: Id, productId: Id });
export const SuggestedPriceDTO = z
  .object({
    unitPrice: MoneySchema.nullable(),
    basis: z.enum(["last_order", "none"]),
    orderNumber: z.string().optional(),
    orderDate: IsoDate.optional(),
    quantity: z.number().optional(),
  })
  .meta({ id: "SuggestedPrice" });
export type SuggestedPriceDTO = z.infer<typeof SuggestedPriceDTO>;
