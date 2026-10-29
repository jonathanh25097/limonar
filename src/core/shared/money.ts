import { DomainError } from "./errors";

/** ISO 4217. NIO = córdobas, USD = dólares. */
export const CURRENCIES = ["NIO", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

/**
 * Money is always an integer number of minor units (centavos / cents) plus a
 * currency. Never use floats for amounts.
 */
export interface Money {
  amount: number;
  currency: Currency;
}

export const money = (amount: number, currency: Currency): Money => {
  if (!Number.isSafeInteger(amount)) {
    throw new DomainError("validation", `Money amount must be an integer number of centavos, got ${amount}`);
  }
  return { amount, currency };
};

export const zero = (currency: Currency): Money => ({ amount: 0, currency });

export const add = (a: Money, b: Money): Money => {
  assertSameCurrency(a, b);
  return money(a.amount + b.amount, a.currency);
};

export const subtract = (a: Money, b: Money): Money => {
  assertSameCurrency(a, b);
  return money(a.amount - b.amount, a.currency);
};

/**
 * Unit price × quantity. Quantity may be fractional (kg, liters), so the result
 * is rounded half-away-from-zero to the nearest centavo.
 */
export const multiply = (unitPrice: Money, quantity: number): Money =>
  money(Math.sign(unitPrice.amount * quantity) * Math.round(Math.abs(unitPrice.amount * quantity)), unitPrice.currency);

export const sum = (items: Money[], currency: Currency): Money => items.reduce(add, zero(currency));

const assertSameCurrency = (a: Money, b: Money) => {
  if (a.currency !== b.currency) {
    throw new DomainError("validation", `Cannot combine ${a.currency} and ${b.currency} without an exchange rate`);
  }
};

const SYMBOL: Record<Currency, string> = { NIO: "C$", USD: "US$" };

/** "C$ 1,800.00" */
export const formatMoney = (m: Money): string => {
  const major = (m.amount / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${SYMBOL[m.currency]} ${major}`;
};

/** Converts a decimal major-unit amount (e.g. 3.5 córdobas) to centavos. */
export const fromMajor = (major: number, currency: Currency): Money => money(Math.round(major * 100), currency);
