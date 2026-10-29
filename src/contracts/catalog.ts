import { z } from "zod";
import { UNITS } from "@/core/catalog/product";
import { CUSTOMER_TYPES, PAYMENT_RULES } from "@/core/sales/customer";
import { DivisionIdSchema, Id } from "./common";

export const ProductDTO = z
  .object({
    id: Id,
    divisionId: DivisionIdSchema,
    code: z.string(),
    name: z.string(),
    unit: z.enum(UNITS),
    attributes: z.record(z.string(), z.string()),
    aliases: z.array(z.string()),
    active: z.boolean(),
  })
  .meta({ id: "Product" });
export type ProductDTO = z.infer<typeof ProductDTO>;

export const CreateProductRequest = z
  .object({
    divisionId: DivisionIdSchema,
    name: z.string().trim().min(1).max(80),
    unit: z.enum(UNITS).default("unit"),
    attributes: z.record(z.string(), z.string()).default({}),
    aliases: z.array(z.string().trim().min(1)).default([]),
  })
  .meta({ id: "CreateProductRequest" });

export const ListProductsQuery = z.object({
  division: DivisionIdSchema.optional(),
  includeInactive: z.stringbool().default(false),
});

export const CustomerDTO = z
  .object({
    id: Id,
    name: z.string(),
    type: z.enum(CUSTOMER_TYPES),
    paymentRule: z.enum(PAYMENT_RULES),
    divisionIds: z.array(DivisionIdSchema),
    phone: z.string().optional(),
    defaultDeliveryPoint: z.string().optional(),
    linkedUserId: Id.optional(),
    active: z.boolean(),
  })
  .meta({ id: "Customer" });
export type CustomerDTO = z.infer<typeof CustomerDTO>;

export const CreateCustomerRequest = z
  .object({
    name: z.string().trim().min(1).max(120),
    type: z.enum(CUSTOMER_TYPES),
    paymentRule: z.enum(PAYMENT_RULES),
    divisionIds: z.array(DivisionIdSchema).min(1).default(["lemons"]),
    phone: z.string().trim().max(20).optional(),
    defaultDeliveryPoint: z.string().trim().max(120).optional(),
    linkedUserId: Id.optional(),
  })
  .meta({ id: "CreateCustomerRequest" });

export const ListCustomersQuery = z.object({
  division: DivisionIdSchema.optional(),
  q: z.string().trim().max(60).optional(),
});

export const DivisionDTO = z
  .object({
    id: DivisionIdSchema,
    name: z.string(),
    status: z.enum(["active", "planned"]),
    modules: z.array(z.string()),
    productAttributes: z.array(
      z.object({ key: z.string(), label: z.string(), values: z.array(z.string()).optional() }),
    ),
  })
  .meta({ id: "Division" });
