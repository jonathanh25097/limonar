import { assertCan, can } from "../auth/roles";
import type { DivisionId } from "../divisions";
import type { UnitOfMeasure } from "../catalog/product";
import type { Actor } from "../shared/actor";
import { DomainError } from "../shared/errors";
import { assertNotCreator, nextStatus, statusChange, type Recorded, type TransitionTable } from "../shared/lifecycle";
import { multiply, sum, type Currency, type Money } from "../shared/money";

export const ORDER_STATUSES = ["draft", "pending_approval", "approved", "fulfilled", "rejected", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Where the fruit for an approved order comes from. */
export const ORDER_SOURCES = ["farm_cut", "consignment_stock"] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export const ORDER_TRANSITIONS = {
  submit: { from: ["draft"], to: "pending_approval" },
  /** "Cambiar": the approver sends it back to whoever drafted it. */
  return: { from: ["pending_approval"], to: "draft" },
  approve: { from: ["pending_approval"], to: "approved" },
  reject: { from: ["pending_approval"], to: "rejected" },
  cancel: { from: ["draft", "pending_approval", "approved"], to: "cancelled" },
  fulfill: { from: ["approved"], to: "fulfilled" },
} as const satisfies TransitionTable<OrderStatus, string>;
export type OrderAction = keyof typeof ORDER_TRANSITIONS;

export interface OrderLine {
  productId: string;
  /** Snapshot so the order reads the same even if the product is renamed later. */
  productName: string;
  unit: UnitOfMeasure;
  quantity: number;
  /** May be empty while drafting ("Sin precio"); every line needs one before approval. */
  unitPrice: Money | null;
}

export interface Order extends Recorded<OrderStatus> {
  id: string;
  divisionId: DivisionId;
  number: string; // PED-0142
  customerId: string;
  customerName: string;
  currency: Currency;
  lines: OrderLine[];
  neededBy: Date;
  deliveryPoint: string;
  note?: string;
  source?: OrderSource;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: Date;
  rejectReason?: string;
  cancelReason?: string;
  /** Set on an order created to replace a cancelled one. */
  replacesOrderId?: string;
}

export interface DraftInput {
  lines: { quantity: number; unitPrice: Money | null }[];
  currency: Currency;
  neededBy: Date;
  deliveryPoint: string;
}

export const validateDraft = (input: DraftInput) => {
  if (input.lines.length === 0) {
    throw new DomainError("validation", "An order needs at least one line", { field: "lines" });
  }
  input.lines.forEach((line, i) => {
    if (!(line.quantity > 0)) {
      throw new DomainError("validation", "Quantity must be greater than zero", { field: `lines.${i}.quantity` });
    }
    if (line.unitPrice) {
      if (line.unitPrice.amount < 0) {
        throw new DomainError("validation", "Price can't be negative", { field: `lines.${i}.unitPrice` });
      }
      if (line.unitPrice.currency !== input.currency) {
        throw new DomainError("validation", `Every price must be in ${input.currency}`, {
          field: `lines.${i}.unitPrice`,
        });
      }
    }
  });
  if (!input.deliveryPoint.trim()) {
    throw new DomainError("validation", "Delivery point is required", { field: "deliveryPoint" });
  }
};

export const lineTotal = (line: Pick<OrderLine, "quantity" | "unitPrice">): Money | null =>
  line.unitPrice ? multiply(line.unitPrice, line.quantity) : null;

/** The order total, or null while any line is still unpriced. */
export const orderTotal = (order: Pick<Order, "lines" | "currency">): Money | null => {
  const totals = order.lines.map(lineTotal);
  if (totals.some((t) => t === null)) return null;
  return sum(totals as Money[], order.currency);
};

export const isLocked = (order: Pick<Order, "status">) => order.status !== "draft";

/** Only a draft can be edited, and only by whoever drafted it or the office/owners. */
export const assertCanEdit = (order: Order, actor: Actor) => {
  if (isLocked(order)) {
    throw new DomainError("locked", "Only a draft order can be changed. Cancel it and create a new one.");
  }
  if (order.createdBy !== actor.userId && !can(actor, "orders.read.all")) {
    throw new DomainError("forbidden", "You can only change orders you created");
  }
};

/**
 * Applies a lifecycle action and returns the fields to write. Pure: the caller
 * persists the result with a guard on the current status and version.
 */
export const transition = (
  order: Order,
  action: OrderAction,
  actor: Actor,
  at: Date,
  params: {
    note?: string;
    source?: OrderSource;
    /** Prices the approver fills in for unpriced lines, by line index. */
    prices?: Record<number, Money>;
  } = {},
): Partial<Order> & Pick<Order, "status" | "statusHistory"> => {
  const to = nextStatus(ORDER_TRANSITIONS, order.status, action);
  const base = {
    status: to,
    statusHistory: [...order.statusHistory, statusChange(order.status, to, actor, at, params.note)],
  };

  switch (action) {
    case "submit": {
      if (order.createdBy !== actor.userId && !can(actor, "orders.read.all")) {
        throw new DomainError("forbidden", "Only whoever drafted the order can send it for approval");
      }
      return base;
    }
    case "return":
    case "reject": {
      assertCan(actor, "orders.approve");
      assertNotCreator(order, actor, action === "reject" ? "reject" : "send back");
      if (!params.note?.trim()) {
        throw new DomainError("validation", "Say why", { field: "note" });
      }
      return action === "reject" ? { ...base, rejectReason: params.note } : base;
    }
    case "approve": {
      assertCan(actor, "orders.approve");
      assertNotCreator(order, actor);
      if (!params.source) {
        throw new DomainError("validation", "Choose where the fruit comes from", { field: "source" });
      }
      const lines = order.lines.map((line, i) => {
        if (line.unitPrice) return line; // a price set while drafting stays as agreed
        const price = params.prices?.[i];
        if (!price) {
          throw new DomainError("validation", `Line ${i + 1} (${line.productName}) has no price`, {
            field: `prices.${i}`,
          });
        }
        if (price.currency !== order.currency || price.amount < 0) {
          throw new DomainError("validation", `Invalid price for line ${i + 1}`, { field: `prices.${i}` });
        }
        return { ...line, unitPrice: price };
      });
      return {
        ...base,
        lines,
        source: params.source,
        approvedBy: actor.userId,
        approvedByName: actor.name,
        approvedAt: at,
      };
    }
    case "cancel": {
      const ownDraft = order.status === "draft" && order.createdBy === actor.userId;
      if (!ownDraft) assertCan(actor, "orders.cancel");
      if (!params.note?.trim()) {
        throw new DomainError("validation", "Say why the order is cancelled", { field: "note" });
      }
      return { ...base, cancelReason: params.note };
    }
    case "fulfill":
      return base;
  }
};

/** "PED-0142" */
export const formatOrderNumber = (seq: number) => `PED-${String(seq).padStart(4, "0")}`;
