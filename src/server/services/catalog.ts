import type { Filter } from "mongodb";
import { z } from "zod";
import { assertCan, can } from "@/core/auth/roles";
import { productCode, validateProductAttributes } from "@/core/catalog/product";
import { DIVISIONS } from "@/core/divisions";
import type { Actor } from "@/core/shared/actor";
import { DomainError } from "@/core/shared/errors";
import type {
  CreateCustomerRequest,
  CreateProductRequest,
  CustomerDTO,
  ListCustomersQuery,
  ListProductsQuery,
  ProductDTO,
} from "@/contracts/catalog";
import { audit } from "../audit";
import { collections, newId, type CustomerDoc, type ProductDoc } from "../db/collections";
import { getDb } from "../db/mongo";

export const toProductDTO = ({ _id, createdAt: _c, createdBy: _b, ...p }: ProductDoc): ProductDTO => ({
  id: _id,
  ...p,
});

export const toCustomerDTO = ({ _id, createdAt: _c, createdBy: _b, ...c }: CustomerDoc): CustomerDTO => ({
  id: _id,
  ...c,
});

export const listDivisions = () => Object.values(DIVISIONS).map(({ costCenter: _cc, ...d }) => d);

export const listProducts = async (actor: Actor, q: z.output<typeof ListProductsQuery>) => {
  assertCan(actor, "catalog.read");
  const filter: Filter<ProductDoc> = {};
  if (q.division) filter.divisionId = q.division;
  if (!q.includeInactive) filter.active = true;
  const docs = await collections(await getDb())
    .products.find(filter)
    .sort({ divisionId: 1, name: 1 })
    .toArray();
  return docs.map(toProductDTO);
};

export const createProduct = async (actor: Actor, input: z.output<typeof CreateProductRequest>) => {
  assertCan(actor, "catalog.manage");
  validateProductAttributes(input.divisionId, input.attributes);
  const db = await getDb();
  const doc: ProductDoc = {
    _id: newId(),
    divisionId: input.divisionId,
    code: productCode([input.name]),
    name: input.name,
    unit: input.unit,
    attributes: input.attributes,
    aliases: input.aliases,
    active: true,
    createdAt: new Date(),
    createdBy: actor.userId,
  };
  await collections(db).products.insertOne(doc);
  await audit(db, { actor, action: "create", collection: "products", docId: doc._id, before: null, after: doc });
  return toProductDTO(doc);
};

export const listCustomers = async (actor: Actor, q: z.output<typeof ListCustomersQuery>) => {
  const c = collections(await getDb());
  const filter: Filter<CustomerDoc> = { active: true };
  if (q.division) filter.divisionIds = q.division;
  if (q.q) filter.name = { $regex: escapeRegex(q.q), $options: "i" };
  // A buyer only sees the customer records linked to them.
  if (!can(actor, "customers.read")) {
    if (!actor.roles.includes("buyer")) throw new DomainError("forbidden", "Your role can't see customers");
    filter.linkedUserId = actor.userId;
  }
  const docs = await c.customers.find(filter).sort({ name: 1 }).limit(200).toArray();
  return docs.map(toCustomerDTO);
};

export const createCustomer = async (actor: Actor, input: z.output<typeof CreateCustomerRequest>) => {
  assertCan(actor, "catalog.propose");
  const db = await getDb();
  const doc: CustomerDoc = {
    _id: newId(),
    ...input,
    active: true,
    createdAt: new Date(),
    createdBy: actor.userId,
  };
  await collections(db).customers.insertOne(doc);
  await audit(db, { actor, action: "create", collection: "customers", docId: doc._id, before: null, after: doc });
  return toCustomerDTO(doc);
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
