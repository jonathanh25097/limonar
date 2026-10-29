/**
 * A division is a line of business on the farm. Every operational document
 * (product, order, asset, batch, expense…) carries a `divisionId`, so a second
 * line can be switched on without reshaping the data.
 *
 * Lemons is the only one live today. Cattle is reserved: its herd is modelled
 * as *assets* (individually tracked animals, see core/assets) rather than as
 * counted stock, while anything it sells by quantity (milk, kg on the hoof)
 * still goes through the same products → orders → deliveries → payments flow.
 */
export const DIVISION_IDS = ["lemons", "cattle"] as const;
export type DivisionId = (typeof DIVISION_IDS)[number];

export type DivisionModule =
  | "sales" // products, orders, deliveries, buyer counts, payments
  | "consignment" // stock held and sold by an agent
  | "orchard" // blocks → sections → plants, colour status
  | "harvest" // batches and per-basket tallies
  | "herd"; // individual animals, paddocks, weights, health

export interface DivisionDefinition {
  id: DivisionId;
  name: string;
  status: "active" | "planned";
  modules: DivisionModule[];
  /**
   * The attributes that identify one of this division's products. Lemons are
   * sold by variety and grade; another division declares its own.
   */
  productAttributes: { key: string; label: string; values?: string[] }[];
  /** Default cost-center code for money that belongs to this division. */
  costCenter: string;
}

export const DIVISIONS: Record<DivisionId, DivisionDefinition> = {
  lemons: {
    id: "lemons",
    name: "Limones",
    status: "active",
    modules: ["sales", "consignment", "orchard", "harvest"],
    productAttributes: [
      { key: "variety", label: "Variedad", values: ["persa", "criollo"] },
      { key: "grade", label: "Calidad", values: ["jumbo", "primera", "manchado", "rechazado"] },
    ],
    costCenter: "limones",
  },
  cattle: {
    id: "cattle",
    name: "Ganado",
    status: "planned",
    modules: ["sales", "herd"],
    productAttributes: [],
    costCenter: "ganado",
  },
};

export const isDivisionId = (v: unknown): v is DivisionId =>
  typeof v === "string" && (DIVISION_IDS as readonly string[]).includes(v);

export const activeDivisions = () => Object.values(DIVISIONS).filter((d) => d.status === "active");
