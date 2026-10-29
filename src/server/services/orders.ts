import type { ClientSession, Db, Filter } from "mongodb";
import { z } from "zod";
import { assertCan, can } from "@/core/auth/roles";
import type { Actor } from "@/core/shared/actor";
import { DomainError } from "@/core/shared/errors";
import { statusChange } from "@/core/shared/lifecycle";
import type { Money } from "@/core/shared/money";
import {
  assertCanEdit,
  formatOrderNumber,
  lineTotal,
  orderTotal,
  transition,
  validateDraft,
  type Order,
  type OrderLine,
} from "@/core/sales/order";
import type {
  CreateOrderRequest,
  ListOrdersQuery,
  OrderActionRequest,
  OrderDTO,
  SuggestedPriceDTO,
  UpdateOrderRequest,
} from "@/contracts/orders";
import { audit } from "../audit";
import { collections, newId, nextSequence, type CustomerDoc, type OrderDoc } from "../db/collections";
import { getDb, withTransaction } from "../db/mongo";

type LineInput = { productId: string; quantity: number; unitPrice: Money | null };

// ---------------------------------------------------------------- reading

export const toOrderDTO = (doc: OrderDoc, actor: Actor): OrderDTO => {
  const { _id, ...o } = doc;
  const order: Order = { id: _id, ...o };
  return {
    ...o,
    id: _id,
    lines: o.lines.map((l) => ({ ...l, total: lineTotal(l) })),
    total: orderTotal(order),
    neededBy: o.neededBy.toISOString(),
    approvedAt: o.approvedAt?.toISOString(),
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    statusHistory: o.statusHistory.map((h) => ({ ...h, at: h.at.toISOString() })),
    allowedActions: allowedActions(order, actor),
  };
};

/** What `actor` may do next with `order` — mirrors the checks in core/sales/order. */
export const allowedActions = (order: Order, actor: Actor): OrderDTO["allowedActions"] => {
  const mine = order.createdBy === actor.userId;
  const office = can(actor, "orders.read.all");
  const approver = can(actor, "orders.approve") && !mine;
  const out: OrderDTO["allowedActions"] = [];
  if (order.status === "draft" && (mine || office)) out.push("edit", "submit");
  if (order.status === "pending_approval" && approver) out.push("approve", "return", "reject");
  const cancellable = ["draft", "pending_approval", "approved"].includes(order.status);
  if (cancellable && (can(actor, "orders.cancel") || (order.status === "draft" && mine))) out.push("cancel");
  return out;
};

/** Filter limiting which orders `actor` may see. */
const visibility = async (db: Db, actor: Actor): Promise<Filter<OrderDoc>> => {
  if (can(actor, "orders.read.all")) return {};
  if (actor.roles.includes("buyer")) {
    const own = await collections(db)
      .customers.find({ linkedUserId: actor.userId }, { projection: { _id: 1 } })
      .toArray();
    return { $or: [{ createdBy: actor.userId }, { customerId: { $in: own.map((c) => c._id) } }] };
  }
  if (can(actor, "orders.create")) return { createdBy: actor.userId };
  throw new DomainError("forbidden", "Your role can't see orders");
};

const load = async (db: Db, actor: Actor, id: string, session?: ClientSession) => {
  const doc = await collections(db).orders.findOne({ $and: [{ _id: id }, await visibility(db, actor)] }, { session });
  if (!doc) throw new DomainError("not_found", "Order not found");
  return doc;
};

export const getOrder = async (actor: Actor, id: string) => {
  const db = await getDb();
  return toOrderDTO(await load(db, actor, id), actor);
};

export const listOrders = async (actor: Actor, q: z.output<typeof ListOrdersQuery>) => {
  const db = await getDb();
  const filter: Filter<OrderDoc> = { ...(await visibility(db, actor)) };
  if (q.division) filter.divisionId = q.division;
  if (q.status) filter.status = { $in: q.status };
  if (q.customerId) filter.customerId = q.customerId;
  const docs = await collections(db).orders.find(filter).sort({ createdAt: -1 }).limit(q.limit).toArray();
  return docs.map((d) => toOrderDTO(d, actor));
};

/**
 * "Último precio a este cliente": the price on this customer's most recent
 * approved order for the product. A suggestion only — it never changes an
 * approved order.
 */
export const suggestedPrice = async (
  actor: Actor,
  customerId: string,
  productId: string,
): Promise<SuggestedPriceDTO> => {
  assertCan(actor, "orders.create");
  const db = await getDb();
  const last = await collections(db).orders.findOne(
    {
      customerId,
      status: { $in: ["approved", "fulfilled"] },
      "lines.productId": productId,
    },
    { sort: { approvedAt: -1 } },
  );
  const line = last?.lines.find((l) => l.productId === productId && l.unitPrice);
  if (!last || !line) return { unitPrice: null, basis: "none" };
  return {
    unitPrice: line.unitPrice,
    basis: "last_order",
    orderNumber: last.number,
    orderDate: (last.approvedAt ?? last.createdAt).toISOString(),
    quantity: line.quantity,
  };
};

// ---------------------------------------------------------------- writing

const loadCustomer = async (db: Db, actor: Actor, customerId: string, session?: ClientSession) => {
  const customer = await collections(db).customers.findOne({ _id: customerId, active: true }, { session });
  if (!customer) throw new DomainError("validation", "Customer not found", { field: "customerId" });
  // A buyer places orders only for their own customer record.
  if (!can(actor, "orders.read.all") && !actor.roles.includes("seller") && customer.linkedUserId !== actor.userId) {
    throw new DomainError("forbidden", "You can only place orders for your own account");
  }
  return customer;
};

const buildLines = async (
  db: Db,
  divisionId: Order["divisionId"],
  lines: LineInput[],
  session?: ClientSession,
): Promise<OrderLine[]> => {
  const ids = [...new Set(lines.map((l) => l.productId))];
  const products = await collections(db)
    .products.find({ _id: { $in: ids }, active: true }, { session })
    .toArray();
  const byId = new Map(products.map((p) => [p._id, p]));
  return lines.map((l, i) => {
    const p = byId.get(l.productId);
    if (!p || p.divisionId !== divisionId) {
      throw new DomainError("validation", "Unknown product", { field: `lines.${i}.productId` });
    }
    return { productId: p._id, productName: p.name, unit: p.unit, quantity: l.quantity, unitPrice: l.unitPrice };
  });
};

const assertCustomerInDivision = (customer: CustomerDoc, divisionId: Order["divisionId"]) => {
  if (!customer.divisionIds.includes(divisionId)) {
    throw new DomainError("validation", "This customer doesn't buy from that division", { field: "customerId" });
  }
};

export const createOrder = async (actor: Actor, input: z.output<typeof CreateOrderRequest>) => {
  assertCan(actor, "orders.create");
  return withTransaction(async (session, db) => {
    const customer = await loadCustomer(db, actor, input.customerId, session);
    assertCustomerInDivision(customer, input.divisionId);
    const lines = await buildLines(db, input.divisionId, input.lines, session);
    const neededBy = new Date(input.neededBy);
    validateDraft({ lines, currency: input.currency, neededBy, deliveryPoint: input.deliveryPoint });

    if (input.replacesOrderId) {
      const replaced = await collections(db).orders.findOne({ _id: input.replacesOrderId }, { session });
      if (replaced?.status !== "cancelled") {
        throw new DomainError("validation", "Only a cancelled order can be replaced", { field: "replacesOrderId" });
      }
    }

    const now = new Date();
    const id = newId();
    let order: Order = {
      id,
      divisionId: input.divisionId,
      number: formatOrderNumber(await nextSequence(db, "order", session)),
      customerId: customer._id,
      customerName: customer.name,
      currency: input.currency,
      lines,
      neededBy,
      deliveryPoint: input.deliveryPoint,
      ...(input.note ? { note: input.note } : {}),
      ...(input.replacesOrderId ? { replacesOrderId: input.replacesOrderId } : {}),
      status: "draft",
      statusHistory: [statusChange(null, "draft", actor, now)],
      createdBy: actor.userId,
      createdByName: actor.name,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    if (input.submit) order = { ...order, ...transition(order, "submit", actor, now) };

    const { id: _, ...rest } = order;
    const doc: OrderDoc = { _id: id, ...rest };
    await collections(db).orders.insertOne(doc, { session });
    await audit(db, { actor, action: "create", collection: "orders", docId: id, before: null, after: doc }, session);
    return toOrderDTO(doc, actor);
  });
};

export const updateOrder = async (actor: Actor, id: string, input: z.output<typeof UpdateOrderRequest>) =>
  withTransaction(async (session, db) => {
    const before = await load(db, actor, id, session);
    assertCanEdit({ id, ...before }, actor);
    assertVersion(before, input.expectedVersion);

    const patch: Partial<OrderDoc> = {};
    if (input.customerId && input.customerId !== before.customerId) {
      const customer = await loadCustomer(db, actor, input.customerId, session);
      assertCustomerInDivision(customer, before.divisionId);
      patch.customerId = customer._id;
      patch.customerName = customer.name;
    }
    if (input.lines) patch.lines = await buildLines(db, before.divisionId, input.lines, session);
    if (input.neededBy) patch.neededBy = new Date(input.neededBy);
    if (input.deliveryPoint) patch.deliveryPoint = input.deliveryPoint;
    if (input.note !== undefined) patch.note = input.note;

    const merged = { ...before, ...patch };
    validateDraft(merged);
    return save(db, session, actor, "update", before, { ...patch, updatedAt: new Date() });
  });

export const actOnOrder = async (actor: Actor, id: string, input: z.output<typeof OrderActionRequest>) =>
  withTransaction(async (session, db) => {
    const before = await load(db, actor, id, session);
    assertVersion(before, input.expectedVersion);
    const now = new Date();
    const prices =
      input.action === "approve" && input.prices
        ? Object.fromEntries(Object.entries(input.prices).map(([k, v]) => [Number(k), v]))
        : undefined;
    const patch = transition({ id, ...before }, input.action, actor, now, {
      note: "note" in input ? input.note : undefined,
      source: input.action === "approve" ? input.source : undefined,
      prices,
    });
    return save(db, session, actor, input.action, before, { ...patch, updatedAt: now });
  });

const assertVersion = (doc: OrderDoc, expected: number) => {
  if (doc.version !== expected) {
    throw new DomainError("conflict", "Someone else changed this order. Reload and try again.", {
      currentVersion: doc.version,
    });
  }
};

/**
 * Writes guarded on the status and version that were read, so an approved
 * order can't be modified by a request that raced past the checks above.
 */
const save = async (
  db: Db,
  session: ClientSession,
  actor: Actor,
  action: string,
  before: OrderDoc,
  patch: Partial<OrderDoc>,
) => {
  const { _id: _ignored, ...set } = patch as OrderDoc;
  const after = await collections(db).orders.findOneAndUpdate(
    { _id: before._id, status: before.status, version: before.version },
    { $set: { ...set, version: before.version + 1 } },
    { session, returnDocument: "after" },
  );
  if (!after) throw new DomainError("conflict", "Someone else changed this order. Reload and try again.");
  await audit(db, { actor, action, collection: "orders", docId: before._id, before, after }, session);
  return toOrderDTO(after, actor);
};
