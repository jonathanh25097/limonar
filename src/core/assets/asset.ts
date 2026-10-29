import type { DivisionId } from "../divisions";

/**
 * Assets are things tracked one by one, each with its own history — as
 * opposed to products, which are counted stock. Two kinds are planned:
 *
 * - `plant`: a lemon tree in the orchard map (lemons division). Its status is
 *   the colour on the map: green harvested, yellow ready, red not ready,
 *   orange problem.
 * - `animal`: a head of cattle (cattle division) with an ear tag, birth,
 *   weights and health events.
 *
 * Both live in a location tree — block → section for the orchard, farm →
 * paddock for the herd — and both keep an append-only event log. Nothing here
 * is wired to storage yet; it fixes the shape so the orchard (next) and the
 * herd (later) share one model instead of two.
 */
export const ASSET_KINDS = ["plant", "animal"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export interface Location {
  id: string;
  divisionId: DivisionId;
  /** "block", "section", "paddock", "house"… */
  type: string;
  name: string;
  parentId: string | null;
}

export interface Asset {
  id: string;
  divisionId: DivisionId;
  kind: AssetKind;
  /** Plant number "A2-01" or ear tag. Unique within the division. */
  tag: string;
  locationId: string;
  /** Plant: "green" | "yellow" | "red" | "orange". Animal: "active" | "sold" | "dead"… */
  status: string;
  attributes: Record<string, string | number>;
  acquiredAt?: Date;
  /** Where it came from: bought, grafted, born on farm. */
  source?: string;
  active: boolean;
}

/** One line of an asset's history: status change, weighing, treatment, move. */
export interface AssetEvent {
  id: string;
  assetId: string;
  type: string;
  at: Date;
  by: string;
  note?: string;
  data?: Record<string, unknown>;
}

export const PLANT_STATUSES = {
  green: "Cosechada",
  yellow: "Lista para cosechar",
  red: "No lista",
  orange: "Problema",
} as const;
