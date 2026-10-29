import { MongoClient, type Db } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Role } from "@/core/auth/roles";
import { hashPin } from "@/server/auth/password";
import { collections, ensureIndexes, newId } from "@/server/db/collections";
import { useDbForTests } from "@/server/db/mongo";
import * as login from "./auth/login/route";
import * as products from "./products/route";
import * as customers from "./customers/route";
import * as orders from "./orders/route";
import * as order from "./orders/[id]/route";
import * as actions from "./orders/[id]/actions/route";
import * as suggested from "./prices/suggested/route";

/**
 * Drives the API the way any client would: real route handlers, real
 * MongoDB (in memory, as a replica set so transactions work), bearer tokens.
 */

let rs: MongoMemoryReplSet;
let client: MongoClient;
let db: Db;
const tokens: Record<string, string> = {};
const ids: Record<string, string> = {};

const call = async (
  route: (req: Request, ctx: { params: Promise<never> }) => Promise<Response>,
  opts: { as?: string; method?: string; path?: string; body?: unknown; params?: Record<string, string> } = {},
) => {
  const req = new Request(`http://test/api/v1${opts.path ?? "/"}`, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: {
      ...(opts.as ? { Authorization: `Bearer ${tokens[opts.as]}` } : {}),
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const res = await route(req, { params: Promise.resolve(opts.params ?? {}) as Promise<never> });
  return { status: res.status, json: await res.json() };
};

const USERS: [string, Role[]][] = [
  ["maria", ["owner"]],
  ["adrian", ["owner"]],
  ["ivania", ["office", "seller"]],
  ["guillermo", ["field"]],
  ["mauricio", ["buyer"]],
];

beforeAll(async () => {
  rs = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  client = await new MongoClient(rs.getUri()).connect();
  db = client.db("test");
  await ensureIndexes(db);
  process.env.MONGODB_URI = rs.getUri();
  process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-!!";
  useDbForTests(client, db);

  const c = collections(db);
  const pinHash = await hashPin("1234");
  for (const [i, [name, roles]] of USERS.entries()) {
    ids[name] = newId();
    await c.users.insertOne({
      _id: ids[name],
      name,
      phone: `5058000000${i}`,
      roles,
      pinHash,
      active: true,
      createdAt: new Date(),
    });
    const res = await call(login.POST, { body: { phone: `5058000000${i}`, pin: "1234" } });
    tokens[name] = res.json.data.token;
  }
  for (const grade of ["primera", "manchado"]) {
    ids[grade] = newId();
    await c.products.insertOne({
      _id: ids[grade],
      divisionId: "lemons",
      code: `persa-${grade}`,
      name: `Persa ${grade}`,
      unit: "unit",
      attributes: { variety: "persa", grade },
      aliases: [],
      active: true,
      createdAt: new Date(),
      createdBy: "system",
    });
  }
  const tina = await call(customers.POST, {
    as: "ivania",
    body: { name: "Doña Tina", type: "retail", paymentRule: "on_delivery" },
  });
  ids.tina = tina.json.data.id;
  ids.mauricioCustomer = newId();
  await c.customers.insertOne({
    _id: ids.mauricioCustomer,
    name: "Ing. Mauricio Hernández",
    type: "wholesale",
    paymentRule: "after_count",
    divisionIds: ["lemons"],
    linkedUserId: ids.mauricio,
    active: true,
    createdAt: new Date(),
    createdBy: "system",
  });
});

afterAll(async () => {
  await client?.close();
  await rs?.stop();
});

const newOrder = (over: Record<string, unknown> = {}) => ({
  customerId: ids.tina,
  neededBy: "2026-10-16T14:00:00.000Z",
  deliveryPoint: "Mercado Central",
  lines: [{ productId: ids.primera, quantity: 600, unitPrice: { amount: 300, currency: "NIO" } }],
  ...over,
});

describe("auth", () => {
  it("rejects a wrong PIN without saying which part was wrong", async () => {
    const res = await call(login.POST, { body: { phone: "50580000000", pin: "9999" } });
    expect(res.status).toBe(401);
    expect(res.json.error.message).toBe("Phone or PIN is wrong");
  });

  it("requires a session for everything else", async () => {
    const res = await call(orders.GET);
    expect(res.status).toBe(401);
    expect(res.json.error.code).toBe("unauthenticated");
  });
});

describe("orders, end to end", () => {
  it("drafts, submits, approves and then refuses edits", async () => {
    const created = await call(orders.POST, { as: "ivania", body: newOrder({ submit: true }) });
    expect(created.status).toBe(201);
    const o = created.json.data;
    expect(o).toMatchObject({
      number: "PED-0001",
      status: "pending_approval",
      total: { amount: 180000, currency: "NIO" },
    });
    expect(o.allowedActions).toEqual([]);

    // The owner sees approve; field staff don't.
    const asOwner = await call(order.GET, { as: "maria", params: { id: o.id } });
    expect(asOwner.json.data.allowedActions).toEqual(expect.arrayContaining(["approve", "reject", "return", "cancel"]));

    const denied = await call(actions.POST, {
      as: "guillermo",
      params: { id: o.id },
      body: { action: "approve", expectedVersion: o.version, source: "farm_cut" },
    });
    expect(denied.status).toBe(403);

    const approved = await call(actions.POST, {
      as: "maria",
      params: { id: o.id },
      body: { action: "approve", expectedVersion: o.version, source: "farm_cut" },
    });
    expect(approved.status).toBe(200);
    expect(approved.json.data).toMatchObject({ status: "approved", approvedByName: "maria", source: "farm_cut" });

    const edit = await call(order.PATCH, {
      as: "ivania",
      method: "PATCH",
      params: { id: o.id },
      body: {
        expectedVersion: approved.json.data.version,
        lines: [{ productId: ids.primera, quantity: 600, unitPrice: { amount: 200, currency: "NIO" } }],
      },
    });
    expect(edit.status).toBe(409);
    expect(edit.json.error.code).toBe("locked");

    // Every step is in the audit log.
    const log = await collections(db).auditLog.find({ docId: o.id }).sort({ at: 1 }).toArray();
    expect(log.map((l) => l.action)).toEqual(["create", "approve"]);
  });

  it("enforces the two-person rule on the server", async () => {
    const created = await call(orders.POST, { as: "maria", body: newOrder({ submit: true }) });
    const res = await call(actions.POST, {
      as: "maria",
      params: { id: created.json.data.id },
      body: { action: "approve", expectedVersion: created.json.data.version, source: "farm_cut" },
    });
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe("two_person_rule");

    const byOther = await call(actions.POST, {
      as: "adrian",
      params: { id: created.json.data.id },
      body: { action: "approve", expectedVersion: created.json.data.version, source: "consignment_stock" },
    });
    expect(byOther.status).toBe(200);
  });

  it("rejects a stale version instead of overwriting someone else's change", async () => {
    const created = await call(orders.POST, { as: "ivania", body: newOrder({ submit: true }) });
    const { id, version } = created.json.data;
    await call(actions.POST, {
      as: "maria",
      params: { id },
      body: { action: "return", expectedVersion: version, note: "Revisar precio" },
    });
    const stale = await call(actions.POST, {
      as: "adrian",
      params: { id },
      body: { action: "approve", expectedVersion: version, source: "farm_cut" },
    });
    expect(stale.status).toBe(409);
    expect(stale.json.error.code).toBe("conflict");
  });

  it("lets the approver price a 'Sin precio' order, then suggests that price next time", async () => {
    const created = await call(orders.POST, {
      as: "mauricio",
      body: newOrder({
        customerId: ids.mauricioCustomer,
        submit: true,
        lines: [{ productId: ids.manchado, quantity: 7000, unitPrice: null }],
      }),
    });
    expect(created.status).toBe(201);
    expect(created.json.data.total).toBeNull();

    const noPrice = await call(actions.POST, {
      as: "adrian",
      params: { id: created.json.data.id },
      body: { action: "approve", expectedVersion: created.json.data.version, source: "farm_cut" },
    });
    expect(noPrice.status).toBe(400);

    const approved = await call(actions.POST, {
      as: "adrian",
      params: { id: created.json.data.id },
      body: {
        action: "approve",
        expectedVersion: created.json.data.version,
        source: "farm_cut",
        prices: { "0": { amount: 130, currency: "NIO" } },
      },
    });
    expect(approved.json.data.total).toEqual({ amount: 910000, currency: "NIO" });

    const suggestion = await call(suggested.GET, {
      as: "ivania",
      path: `/prices/suggested?customerId=${ids.mauricioCustomer}&productId=${ids.manchado}`,
    });
    expect(suggestion.json.data).toMatchObject({ basis: "last_order", unitPrice: { amount: 130 }, quantity: 7000 });
  });

  it("keeps a buyer to their own account", async () => {
    const forTina = await call(orders.POST, { as: "mauricio", body: newOrder() });
    expect(forTina.status).toBe(403);

    const list = await call(orders.GET, { as: "mauricio", path: "/orders" });
    expect(list.json.data.length).toBeGreaterThan(0);
    expect(list.json.data.every((o: { customerId: string }) => o.customerId === ids.mauricioCustomer)).toBe(true);
  });

  it("validates input with field-level details", async () => {
    const res = await call(orders.POST, { as: "ivania", body: newOrder({ lines: [] }) });
    expect(res.status).toBe(400);
    expect(res.json.error.details.issues[0].path).toBe("lines");
  });
});

describe("catalog", () => {
  it("only owners create products, and attributes must fit the division", async () => {
    const body = { divisionId: "lemons", name: "Criollo jumbo", attributes: { variety: "criollo", grade: "jumbo" } };
    expect((await call(products.POST, { as: "ivania", body })).status).toBe(403);
    expect(
      (await call(products.POST, { as: "maria", body: { ...body, attributes: { variety: "criollo" } } })).status,
    ).toBe(400);
    const ok = await call(products.POST, { as: "maria", body });
    expect(ok.status).toBe(201);
    expect(ok.json.data.code).toBe("criollo-jumbo");
  });
});
