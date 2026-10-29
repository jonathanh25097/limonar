import { describe, expect, it } from "vitest";
import type { Actor } from "../shared/actor";
import { fromMajor } from "../shared/money";
import { statusChange } from "../shared/lifecycle";
import { orderTotal, transition, validateDraft, type Order } from "./order";

const ivania: Actor = { userId: "u-ivania", name: "Ivania", roles: ["office", "seller"] };
const mariaIsabel: Actor = { userId: "u-mi", name: "María Isabel", roles: ["owner"] };
const guillermo: Actor = { userId: "u-g", name: "Guillermo", roles: ["field"] };
const at = new Date("2026-10-15T18:31:00Z");

const order = (over: Partial<Order> = {}): Order => ({
  id: "o1",
  divisionId: "lemons",
  number: "PED-0142",
  customerId: "c1",
  customerName: "Doña Tina",
  currency: "NIO",
  lines: [
    { productId: "p1", productName: "Persa primera", unit: "unit", quantity: 600, unitPrice: fromMajor(3, "NIO") },
  ],
  neededBy: new Date("2026-10-16T14:00:00Z"),
  deliveryPoint: "Mercado Central",
  status: "pending_approval",
  statusHistory: [statusChange(null, "draft", ivania, at)],
  createdBy: ivania.userId,
  createdByName: ivania.name,
  createdAt: at,
  updatedAt: at,
  version: 2,
  ...over,
});

describe("order totals", () => {
  it("is units × price", () => {
    expect(orderTotal(order())).toEqual({ amount: 180000, currency: "NIO" });
  });

  it("is null while a line has no price", () => {
    const o = order({ lines: [{ ...order().lines[0], unitPrice: null }] });
    expect(orderTotal(o)).toBeNull();
  });
});

describe("draft validation", () => {
  const draft = { lines: order().lines, currency: "NIO" as const, neededBy: at, deliveryPoint: "Mercado" };

  it("needs a line, positive quantities and a delivery point", () => {
    expect(() => validateDraft({ ...draft, lines: [] })).toThrow(/at least one line/);
    expect(() => validateDraft({ ...draft, lines: [{ ...draft.lines[0], quantity: 0 }] })).toThrow(/greater than zero/);
    expect(() => validateDraft({ ...draft, deliveryPoint: " " })).toThrow(/Delivery point/);
    expect(() => validateDraft(draft)).not.toThrow();
  });

  it("keeps every price in the order's currency", () => {
    const lines = [{ ...draft.lines[0], unitPrice: fromMajor(3, "USD") }];
    expect(() => validateDraft({ ...draft, lines })).toThrow(/NIO/);
  });
});

describe("approval", () => {
  it("is for owners only", () => {
    expect(() => transition(order(), "approve", guillermo, at, { source: "farm_cut" })).toThrow(
      expect.objectContaining({ code: "forbidden" }),
    );
  });

  it("can't be done by whoever recorded the order, even an owner", () => {
    const own = order({ createdBy: mariaIsabel.userId });
    expect(() => transition(own, "approve", mariaIsabel, at, { source: "farm_cut" })).toThrow(
      expect.objectContaining({ code: "two_person_rule" }),
    );
  });

  it("requires choosing where the fruit comes from", () => {
    expect(() => transition(order(), "approve", mariaIsabel, at)).toThrow(/where the fruit comes from/);
  });

  it("records who approved and when", () => {
    const patch = transition(order(), "approve", mariaIsabel, at, { source: "farm_cut" });
    expect(patch).toMatchObject({ status: "approved", source: "farm_cut", approvedBy: "u-mi", approvedAt: at });
    expect(patch.statusHistory.at(-1)).toMatchObject({ from: "pending_approval", to: "approved", by: "u-mi" });
  });

  it("fills prices for unpriced lines but never overrides a drafted price", () => {
    const o = order({
      lines: [
        { productId: "p1", productName: "Persa", unit: "unit", quantity: 12000, unitPrice: null },
        { productId: "p2", productName: "Criollo", unit: "unit", quantity: 7000, unitPrice: fromMajor(1.3, "NIO") },
      ],
    });
    expect(() => transition(o, "approve", mariaIsabel, at, { source: "farm_cut" })).toThrow(/has no price/);
    const patch = transition(o, "approve", mariaIsabel, at, {
      source: "farm_cut",
      prices: { 0: fromMajor(2, "NIO"), 1: fromMajor(0.9, "NIO") },
    });
    expect(patch.lines!.map((l) => l.unitPrice?.amount)).toEqual([200, 130]);
  });

  it("can't happen twice — an approved order is locked", () => {
    expect(() => transition(order({ status: "approved" }), "approve", mariaIsabel, at, { source: "farm_cut" })).toThrow(
      expect.objectContaining({ code: "invalid_transition" }),
    );
  });
});

describe("reject, return and cancel", () => {
  it("need a reason", () => {
    expect(() => transition(order(), "reject", mariaIsabel, at)).toThrow(/Say why/);
    expect(() => transition(order(), "return", mariaIsabel, at, { note: " " })).toThrow(/Say why/);
    expect(() => transition(order({ status: "approved" }), "cancel", mariaIsabel, at)).toThrow(/cancelled/);
  });

  it("sending back puts the order in draft again", () => {
    expect(transition(order(), "return", mariaIsabel, at, { note: "Precio" }).status).toBe("draft");
  });

  it("lets the creator discard their own draft but only owners cancel after that", () => {
    expect(transition(order({ status: "draft" }), "cancel", ivania, at, { note: "Duplicado" }).status).toBe(
      "cancelled",
    );
    expect(() => transition(order(), "cancel", ivania, at, { note: "x" })).toThrow(
      expect.objectContaining({ code: "forbidden" }),
    );
    expect(
      transition(order({ status: "approved" }), "cancel", mariaIsabel, at, { note: "Cliente cambió" }).status,
    ).toBe("cancelled");
  });
});
