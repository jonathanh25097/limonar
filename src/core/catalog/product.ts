import type { DivisionId } from "../divisions";
import { DIVISIONS } from "../divisions";
import { DomainError } from "../shared/errors";

/**
 * How a product is measured. Lemons are counted one by one; other divisions
 * may sell by weight, volume or head.
 */
export const UNITS = ["unit", "kg", "liter", "head", "crate"] as const;
export type UnitOfMeasure = (typeof UNITS)[number];

/**
 * Something sold or held as fungible stock: "persa primera", "criollo
 * manchado". Products are flexible settings — owners add, rename or retire
 * them at any time — but a product referenced by an approved order is never
 * deleted, only deactivated.
 */
export interface Product {
  id: string;
  divisionId: DivisionId;
  code: string; // stable, e.g. "persa-primera"
  name: string; // shown to people, e.g. "Persa primera"
  unit: UnitOfMeasure;
  attributes: Record<string, string>;
  /** Other names people use in chats: "perza", "Tahití", "sin semilla". */
  aliases: string[];
  active: boolean;
}

/** Checks attributes against the division's declared ones (when it lists allowed values). */
export const validateProductAttributes = (divisionId: DivisionId, attributes: Record<string, string>) => {
  for (const def of DIVISIONS[divisionId].productAttributes) {
    const value = attributes[def.key];
    if (value === undefined) {
      throw new DomainError("validation", `${def.label} is required`, { field: `attributes.${def.key}` });
    }
    if (def.values && !def.values.includes(value)) {
      throw new DomainError("validation", `${def.label} must be one of ${def.values.join(", ")}`, {
        field: `attributes.${def.key}`,
      });
    }
  }
};

export const productCode = (parts: string[]) =>
  parts
    .map((p) =>
      p
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    )
    .filter(Boolean)
    .join("-");
