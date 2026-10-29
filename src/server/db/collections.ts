import type { ClientSession, Db } from "mongodb";
import { ObjectId } from "mongodb";
import type { Role } from "@/core/auth/roles";
import type { Product } from "@/core/catalog/product";
import type { Customer } from "@/core/sales/customer";
import type { Order } from "@/core/sales/order";

/**
 * Stored shapes. Domain types use `id`; documents use a string `_id` so ids
 * stay opaque strings end to end (no ObjectId leaking into the API).
 */
type Stored<T extends { id: string }> = Omit<T, "id"> & { _id: string };

export interface UserDoc {
  _id: string;
  name: string;
  phone: string;
  roles: Role[];
  pinHash: string;
  active: boolean;
  createdAt: Date;
}

export type ProductDoc = Stored<Product> & { createdAt: Date; createdBy: string };
export type CustomerDoc = Stored<Customer> & { createdAt: Date; createdBy: string };
export type OrderDoc = Stored<Order>;

export interface AuditDoc {
  _id: string;
  at: Date;
  userId: string;
  userName: string;
  action: string;
  collection: string;
  docId: string;
  before: unknown;
  after: unknown;
}

export interface CounterDoc {
  _id: string;
  seq: number;
}

export const collections = (db: Db) => ({
  users: db.collection<UserDoc>("users"),
  products: db.collection<ProductDoc>("products"),
  customers: db.collection<CustomerDoc>("customers"),
  orders: db.collection<OrderDoc>("orders"),
  auditLog: db.collection<AuditDoc>("auditLog"),
  counters: db.collection<CounterDoc>("counters"),
});

export const newId = () => new ObjectId().toHexString();

/** Next value of a named sequence ("order" → 142). Gaps are fine; duplicates are not. */
export const nextSequence = async (db: Db, name: string, session?: ClientSession) => {
  const res = await collections(db).counters.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", session },
  );
  return res!.seq;
};

export const ensureIndexes = async (db: Db) => {
  const c = collections(db);
  await Promise.all([
    c.users.createIndex({ phone: 1 }, { unique: true }),
    c.products.createIndex({ divisionId: 1, code: 1 }, { unique: true }),
    c.customers.createIndex({ name: 1 }),
    c.customers.createIndex({ linkedUserId: 1 }, { sparse: true }),
    c.orders.createIndex({ number: 1 }, { unique: true }),
    c.orders.createIndex({ divisionId: 1, status: 1, neededBy: 1 }),
    c.orders.createIndex({ customerId: 1, approvedAt: -1 }),
    c.auditLog.createIndex({ collection: 1, docId: 1, at: 1 }),
  ]);
};
