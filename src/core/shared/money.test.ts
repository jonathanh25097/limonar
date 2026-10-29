import { describe, expect, it } from "vitest";
import { add, formatMoney, fromMajor, money, multiply, sum } from "./money";

describe("money", () => {
  it("rejects fractional centavos", () => {
    expect(() => money(1.5, "NIO")).toThrow();
  });

  it("multiplies a unit price by a quantity, rounding to the centavo", () => {
    expect(multiply(fromMajor(3, "NIO"), 600)).toEqual({ amount: 180000, currency: "NIO" });
    expect(multiply(fromMajor(1.3, "NIO"), 0.5)).toEqual({ amount: 65, currency: "NIO" });
    expect(multiply(money(1, "NIO"), 0.5)).toEqual({ amount: 1, currency: "NIO" });
  });

  it("refuses to mix currencies", () => {
    expect(() => add(money(1, "NIO"), money(1, "USD"))).toThrow(/exchange rate/);
  });

  it("sums and formats", () => {
    const total = sum([fromMajor(1800, "NIO"), fromMajor(0.5, "NIO")], "NIO");
    expect(formatMoney(total)).toBe("C$ 1,800.50");
    expect(formatMoney(money(240000, "USD"))).toBe("US$ 2,400.00");
  });

  it("avoids float drift when converting from major units", () => {
    expect(fromMajor(0.1 + 0.2, "NIO").amount).toBe(30);
  });
});
