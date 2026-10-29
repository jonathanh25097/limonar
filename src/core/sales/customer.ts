import type { DivisionId } from "../divisions";

export const CUSTOMER_TYPES = ["wholesale", "retail", "direct", "agent"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

/** When the customer pays: before taking the fruit, on delivery, or after their own count. */
export const PAYMENT_RULES = ["before_pickup", "on_delivery", "after_count"] as const;
export type PaymentRule = (typeof PAYMENT_RULES)[number];

export interface Customer {
  id: string;
  name: string;
  type: CustomerType;
  paymentRule: PaymentRule;
  /** Divisions this customer buys from. A cattle buyer can be the same person as a lemon buyer. */
  divisionIds: DivisionId[];
  phone?: string;
  defaultDeliveryPoint?: string;
  /** Set when the customer also signs in (Mauricio places his own requests). */
  linkedUserId?: string;
  active: boolean;
}
